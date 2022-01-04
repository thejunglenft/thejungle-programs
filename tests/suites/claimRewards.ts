import { expect } from "chai";
import {
  setProvider,
  Provider,
  Program,
  workspace,
  BN,
} from "@project-serum/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { Jungle } from "../../target/types/jungle";
import { airdropUsers, assertFail, merkleCollection } from "../helpers";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MerkleTree } from "../helpers/merkleTree";

export const testClaimRewards = (
  state: {
    owner: Keypair;
    staker: Keypair;
    jungleKey: PublicKey;
    mintRewards: Token;
    maxMultiplier: BN;
    baseWeeklyEmissions: BN;
    start: BN;
  },
  provider: Provider
) =>
  describe("Claim rewards", () => {
    setProvider(provider);

    const program = workspace.Jungle as Program<Jungle>;

    const n = 10;
    let mintRewards: Token,
      mints: Token[],
      holders: Keypair[],
      accounts: PublicKey[] = Array(n).fill(new PublicKey(0));
    let tree: MerkleTree;
    let jungleKey: PublicKey, owner: Keypair, stranger: Keypair;

    const maxRarity = new BN(n);
    const indexStaked = 4;
    const indexStakedOther = 2;

    beforeEach(async () => {
      jungleKey = Keypair.generate().publicKey;
      owner = Keypair.generate();
      stranger = Keypair.generate();

      holders = Array(n)
        .fill(0)
        .map(() => Keypair.generate());
      await airdropUsers([...holders, owner, stranger], provider);
      mintRewards = await Token.createMint(
        provider.connection,
        owner,
        owner.publicKey,
        null,
        9,
        TOKEN_PROGRAM_ID
      );
      const nfts = await merkleCollection(owner, n, provider);
      mints = nfts.mints;
      await Promise.all(
        mints.map(async (mint, i) => {
          accounts[i] = (
            await mint.getOrCreateAssociatedAccountInfo(holders[i].publicKey)
          ).address;
          const ownerAccount = (
            await mint.getOrCreateAssociatedAccountInfo(owner.publicKey)
          ).address;
          await mint.transfer(ownerAccount, accounts[i], owner, [], 1);
        })
      );
      tree = nfts.tree;

      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle"), jungleKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow"), jungleKey.toBuffer()],
        program.programId
      );
      const [rewards, rewardsBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("rewards"),
          jungleKey.toBuffer(),
          mintRewards.publicKey.toBuffer(),
        ],
        program.programId
      );

      const bumpsInit = {
        jungle: jungleBump,
        escrow: escrowBump,
        rewards: rewardsBump,
      };

      await program.rpc.initializeJungle(
        bumpsInit,
        maxRarity,
        state.maxMultiplier,
        state.baseWeeklyEmissions,
        state.start,
        tree.getRootArray(),
        {
          accounts: {
            jungleKey: jungleKey,
            jungle: jungleAddress,
            escrow: escrow,
            mint: mintRewards.publicKey,
            rewardsAccount: rewards,
            owner: owner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [owner],
        }
      );

      // Mint tokens to the jungle
      await mintRewards.mintTo(rewards, owner, [], 10 ** 14);

      const [animal, animalBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("animal", "utf8"),
          mints[indexStaked].publicKey.toBuffer(),
        ],
        program.programId
      );
      const [deposit, depositBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("deposit", "utf8"),
          mints[indexStaked].publicKey.toBuffer(),
        ],
        program.programId
      );

      const bumpsAnimal = {
        animal: animalBump,
        deposit: depositBump,
      };

      await program.rpc.stakeAnimal(
        bumpsAnimal,
        tree.getProofArray(indexStaked),
        new BN(indexStaked),
        new BN(indexStaked % 8),
        {
          accounts: {
            jungle: jungleAddress,
            escrow: escrow,
            animal: animal,
            staker: holders[indexStaked].publicKey,
            mint: mints[indexStaked].publicKey,
            stakerAccount: accounts[indexStaked],
            depositAccount: deposit,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [holders[indexStaked]],
        }
      );

      const [otherAnimal, otherAnimalBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("animal", "utf8"),
          mints[indexStakedOther].publicKey.toBuffer(),
        ],
        program.programId
      );
      const [otherDeposit, otherDepositBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("deposit", "utf8"),
          mints[indexStakedOther].publicKey.toBuffer(),
        ],
        program.programId
      );

      const bumpsAnimalOther = {
        animal: otherAnimalBump,
        deposit: otherDepositBump,
      };

      await program.rpc.stakeAnimal(
        bumpsAnimalOther,
        tree.getProofArray(indexStakedOther),
        new BN(indexStakedOther),
        new BN(indexStakedOther % 8),
        {
          accounts: {
            jungle: jungleAddress,
            escrow: escrow,
            animal: otherAnimal,
            staker: holders[indexStakedOther].publicKey,
            mint: mints[indexStakedOther].publicKey,
            stakerAccount: accounts[indexStakedOther],
            depositAccount: otherDeposit,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [holders[indexStakedOther]],
        }
      );
    });

    it("Claim staking rewards", async () => {
      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle", "utf8"), jungleKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow", "utf8"), jungleKey.toBuffer()],
        program.programId
      );
      const [animal, animalBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("animal", "utf8"),
          mints[indexStaked].publicKey.toBuffer(),
        ],
        program.programId
      );

      const jungleBefore = await program.account.jungle.fetch(jungleAddress);
      const animalBefore = await program.account.animal.fetch(animal);
      const rewardToken = new Token(
        provider.connection,
        jungleBefore.mint,
        TOKEN_PROGRAM_ID,
        holders[indexStaked]
      );

      const [rewardsAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from("rewards", "utf8"),
          jungleBefore.key.toBuffer(),
          jungleBefore.mint.toBuffer(),
        ],
        program.programId
      );

      const stakerAccount = await rewardToken.getOrCreateAssociatedAccountInfo(
        holders[indexStaked].publicKey
      );

      const rewardsBefore = (await rewardToken.getAccountInfo(rewardsAccount))
        .amount;

      const tx = await program.rpc.claimStaking({
        accounts: {
          jungle: jungleAddress,
          escrow: escrow,
          animal: animal,
          staker: holders[indexStaked].publicKey,
          mint: rewardToken.publicKey,
          stakerAccount: stakerAccount.address,
          rewardsAccount: rewardsAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [holders[indexStaked]],
      });
      provider.connection.confirmTransaction(tx);

      const j = await program.account.jungle.fetch(jungleAddress);
      const a = await program.account.animal.fetch(animal);
      const stakerAccountAfter =
        await rewardToken.getOrCreateAssociatedAccountInfo(
          holders[indexStaked].publicKey
        );

      const rewardsAfter = (await rewardToken.getAccountInfo(rewardsAccount))
        .amount;
      const rewardsGiven = rewardsBefore.sub(rewardsAfter);

      // The rewards have been transferred to the staker
      expect(stakerAccountAfter.amount.toString()).to.equal(
        stakerAccount.amount.add(rewardsGiven).toString()
      );

      // The amount given is correct
      const elapsed = a.lastClaim.sub(animalBefore.lastClaim);
      const rarityMultiplier = new BN(10000).add(
        state.maxMultiplier
          .sub(new BN(10000))
          .mul(new BN(indexStaked))
          .div(new BN(n - 1))
      );
      expect(rewardsGiven.toString()).to.equal(
        state.baseWeeklyEmissions
          .mul(elapsed)
          .div(new BN(604800))
          .mul(rarityMultiplier)
          .div(j.animalsStaked)
          .div(new BN(10000))
          .toString()
      );
    });

    it("Can't claim an unstaked token", async () => {
      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle", "utf8"), jungleKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow", "utf8"), jungleKey.toBuffer()],
        program.programId
      );
      const [animal, animalBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("animal", "utf8"),
          mints[indexStaked + 1].publicKey.toBuffer(),
        ],
        program.programId
      );

      const jungleBefore = await program.account.jungle.fetch(jungleAddress);

      const [rewardsAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from("rewards", "utf8"),
          jungleBefore.key.toBuffer(),
          jungleBefore.mint.toBuffer(),
        ],
        program.programId
      );

      const stakerAccount = await mintRewards.getOrCreateAssociatedAccountInfo(
        holders[indexStaked + 1].publicKey
      );

      await assertFail(
        program.rpc.claimStaking({
          accounts: {
            jungle: jungleAddress,
            escrow: escrow,
            animal: animal,
            staker: holders[indexStaked + 1].publicKey,
            mint: mintRewards.publicKey,
            stakerAccount: stakerAccount.address,
            rewardsAccount: rewardsAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [holders[indexStaked + 1]],
        })
      );
    });

    it("Can't claim an unowned token", async () => {
      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle", "utf8"), jungleKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow", "utf8"), jungleKey.toBuffer()],
        program.programId
      );
      const [animal, animalBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("animal", "utf8"),
          mints[indexStakedOther].publicKey.toBuffer(),
        ],
        program.programId
      );

      const jungleBefore = await program.account.jungle.fetch(jungleAddress);

      const [rewardsAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from("rewards", "utf8"),
          jungleBefore.key.toBuffer(),
          jungleBefore.mint.toBuffer(),
        ],
        program.programId
      );

      const stakerAccount = await mintRewards.getOrCreateAssociatedAccountInfo(
        holders[indexStaked].publicKey
      );

      await assertFail(
        program.rpc.claimStaking({
          accounts: {
            jungle: jungleAddress,
            escrow: escrow,
            animal: animal,
            staker: holders[indexStaked].publicKey,
            mint: mintRewards.publicKey,
            stakerAccount: stakerAccount.address,
            rewardsAccount: rewardsAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [holders[indexStaked]],
        })
      );
    });
  });
