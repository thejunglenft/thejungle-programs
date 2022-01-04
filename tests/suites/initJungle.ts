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
import {
  airdropUsers,
  assertFail,
  merkleCollection,
  mintAndTransferRewards,
} from "../helpers";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MerkleTree } from "../helpers/merkleTree";

export const testInitializeJungle = (
  state: {
    owner: Keypair;
    staker: Keypair;
    mints: PublicKey[];
    jungleKey: PublicKey;
    mintRewards: Token;
    maxMultiplier: BN;
    baseWeeklyEmissions: BN;
    start: BN;
  },
  provider: Provider
) =>
  describe("Initializing the jungle", () => {
    setProvider(provider);

    const program = workspace.Jungle as Program<Jungle>;

    let mintRewards: Token, mints: Token[];
    let tree: MerkleTree;

    before(async () => {
      await airdropUsers([state.owner, state.staker], provider);
      const mintInfo = await mintAndTransferRewards(
        provider,
        program.programId,
        state.jungleKey,
        state.owner,
        604800
      );
      mintRewards = mintInfo.mint;
      const nfts = await merkleCollection(
        state.owner,
        state.mints.length,
        provider
      );
      mints = nfts.mints;
      tree = nfts.tree;
    });

    it("Initializes the jungle", async () => {
      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle"), state.jungleKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow"), state.jungleKey.toBuffer()],
        program.programId
      );
      const [rewards, rewardsBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("rewards"),
          state.jungleKey.toBuffer(),
          mintRewards.publicKey.toBuffer(),
        ],
        program.programId
      );

      const bumps = {
        jungle: jungleBump,
        escrow: escrowBump,
        rewards: rewardsBump,
      };

      const maximumRarity = new BN(mints.length - 1);

      await program.rpc.initializeJungle(
        bumps,
        maximumRarity,
        state.maxMultiplier,
        state.baseWeeklyEmissions,
        state.start,
        tree.getRootArray(),
        {
          accounts: {
            jungleKey: state.jungleKey,
            jungle: jungleAddress,
            escrow: escrow,
            mint: mintRewards.publicKey,
            rewardsAccount: rewards,
            owner: state.owner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [state.owner],
        }
      );

      const s = await program.account.jungle.fetch(jungleAddress);

      expect(s.owner.toString()).to.equal(state.owner.publicKey.toString());
      expect(s.escrow.toString()).to.equal(escrow.toString());
      expect(s.mint.toString()).to.equal(mintRewards.publicKey.toString());
      expect(s.maximumRarity.toString()).to.equal(maximumRarity.toString());
      expect(s.maximumRarityMultiplier.toString()).to.equal(
        state.maxMultiplier.toString()
      );
      expect(s.baseWeeklyEmissions.toString()).to.equal(
        state.baseWeeklyEmissions.toString()
      );
      expect(s.start.toString()).to.equal(state.start.toString());
      expect(s.root.toString()).to.equal(
        tree.getRoot().toJSON().data.toString()
      );
    });

    it("Only accepts positive multipliers", async () => {
      const jungleKey = Keypair.generate().publicKey;
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

      const bumps = {
        jungle: jungleBump,
        escrow: escrowBump,
        rewards: rewardsBump,
      };

      const maximumRarity = new BN(mints.length - 1);

      await assertFail(
        program.rpc.initializeJungle(
          bumps,
          maximumRarity,
          new BN(9999),
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
              owner: state.owner.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
              systemProgram: SystemProgram.programId,
            },
            signers: [state.owner],
          }
        )
      );
    });
  });
