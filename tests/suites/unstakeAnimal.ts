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

export const testUnstakeAnimal = (
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
  describe("Unstake an animal", () => {
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

    beforeEach(async () => {
      jungleKey = Keypair.generate().publicKey
      owner = Keypair.generate()
      stranger = Keypair.generate()

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
    });

    it("Unstake a token", async () => {
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
      const [deposit, depositBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("deposit", "utf8"),
          mints[indexStaked].publicKey.toBuffer(),
        ],
        program.programId
      );

      let stakerAccount = await mints[
        indexStaked
      ].getOrCreateAssociatedAccountInfo(holders[indexStaked].publicKey);

      const animalsStakedBefore = (
        await program.account.jungle.fetch(jungleAddress)
      ).animalsStaked;

      await program.rpc.unstakeAnimal({
        accounts: {
          jungle: jungleAddress,
          escrow: escrow,
          animal: animal,
          staker: holders[indexStaked].publicKey,
          mint: mints[indexStaked].publicKey,
          stakerAccount: stakerAccount.address,
          depositAccount: deposit,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [holders[indexStaked]],
      });

      const j = await program.account.jungle.fetch(jungleAddress);

      expect(j.animalsStaked.toString()).to.equal(
        animalsStakedBefore.sub(new BN(1)).toString()
      );

      stakerAccount = await mints[indexStaked].getOrCreateAssociatedAccountInfo(
        holders[indexStaked].publicKey
      );
      expect(stakerAccount.amount.toString()).to.equal(new BN(1).toString());
    });

    it("Can't unstake an unowned token", async () => {
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
      const [deposit, depositBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("deposit", "utf8"),
          mints[indexStaked].publicKey.toBuffer(),
        ],
        program.programId
      );

      const bumps = {
        animal: animalBump,
        deposit: depositBump,
      };

      const stakerAccount = await mints[
        indexStaked
      ].getOrCreateAssociatedAccountInfo(stranger.publicKey);

      await assertFail(
        program.rpc.unstakeAnimal({
          accounts: {
            jungle: jungleAddress,
            escrow: escrow,
            animal: animal,
            staker: stranger.publicKey,
            mint: mints[indexStaked].publicKey,
            stakerAccount: stakerAccount.address,
            depositAccount: deposit,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [stranger],
        })
      );
    });
  });
