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
} from "@solana/web3.js";
import { Jungle } from "../../target/types/jungle";
import { airdropUsers, assertFail, merkleCollection } from "../helpers";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MerkleTree } from "../helpers/merkleTree";

export const testWithdrawRewards = (
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
  describe("Withdraw rewards", () => {
    setProvider(provider);

    const program = workspace.Jungle as Program<Jungle>;

    const n = 10;
    let mintRewards: Token,
      mints: Token[],
      holders: Keypair[],
      accounts: PublicKey[] = Array(n).fill(new PublicKey(0));
    let tree: MerkleTree;
    let jungleKey: PublicKey, owner: Keypair, stranger: Keypair;

    const startingAmount = new BN(10 ** 10);

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
        new BN(10),
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
      await mintRewards.mintTo(rewards, owner, [], startingAmount.toNumber());
    });

    it("Withdraw rewards", async () => {
      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle"), jungleKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow", "utf8"), jungleKey.toBuffer()],
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

      let ownerAccount = await mintRewards.getOrCreateAssociatedAccountInfo(
        owner.publicKey
      );

      const withdraw = new BN(10 ** 9);

      await program.rpc.withdrawRewards(withdraw, {
        accounts: {
          jungle: jungleAddress,
          escrow: escrow,
          mint: mintRewards.publicKey,
          rewardsAccount: rewards,
          owner: owner.publicKey,
          ownerAccount: ownerAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [owner],
      });

      expect(
        (
          await mintRewards.getAccountInfo(ownerAccount.address)
        ).amount.toNumber()
      ).to.equal(ownerAccount.amount.add(withdraw).toNumber());
      expect(
        (await mintRewards.getAccountInfo(rewards)).amount.toNumber()
      ).to.equal(startingAmount.sub(withdraw).toNumber());
    });
  });
