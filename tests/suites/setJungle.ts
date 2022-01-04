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

export const testSetJungle = (
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
  describe("Setting the jungle", () => {
    setProvider(provider);

    const program = workspace.Jungle as Program<Jungle>;

    let mintRewards: Token, mints: Token[];
    let tree: MerkleTree;

    beforeEach(async () => {
      await airdropUsers([state.owner], provider);
      mintRewards = await Token.createMint(
        provider.connection,
        state.owner,
        state.owner.publicKey,
        null,
        9,
        TOKEN_PROGRAM_ID
      );
      const nfts = await merkleCollection(state.owner, 5, provider);
      mints = nfts.mints;
      tree = nfts.tree;
    });

    it("Reset the jungle", async () => {
      const newOwner = Keypair.generate();
      const newMaximumMultiplier = new BN(100000);
      const newWeekly = new BN(100000);

      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle"), state.jungleKey.toBuffer()],
        program.programId
      );

      const maximumRarity = new BN(mints.length - 1);
      const newMaximumRarity = new BN(mints.length + 100);

      await program.rpc.setJungle(
        newMaximumRarity,
        newMaximumMultiplier,
        newWeekly,
        state.start,
        tree.getRootArray(),
        {
          accounts: {
            jungle: jungleAddress,
            owner: state.owner.publicKey,
            newOwner: newOwner.publicKey,
          },
          signers: [state.owner],
        }
      );

      const s = await program.account.jungle.fetch(jungleAddress);

      expect(s.owner.toString()).to.equal(newOwner.publicKey.toString());
      expect(s.maximumRarity.toString()).to.equal(newMaximumRarity.toString());
      expect(s.maximumRarityMultiplier.toString()).to.equal(
        newMaximumMultiplier.toString()
      );
      expect(s.baseWeeklyEmissions.toString()).to.equal(newWeekly.toString());
      expect(s.root.toString()).to.equal(
        tree.getRoot().toJSON().data.toString()
      );

      await program.rpc.setJungle(
        maximumRarity,
        state.maxMultiplier,
        state.baseWeeklyEmissions,
        state.start,
        tree.getRootArray(),
        {
          accounts: {
            jungle: jungleAddress,
            owner: newOwner.publicKey,
            newOwner: state.owner.publicKey,
          },
          signers: [newOwner],
        }
      );
    });

    it("Fails when called by an outsider", async () => {
      const newOwner = Keypair.generate();
      const newMaximumMultiplier = new BN(100000);
      const newWeekly = new BN(100000);

      const [jungleAddress, jungleBump] = await PublicKey.findProgramAddress(
        [Buffer.from("jungle"), state.jungleKey.toBuffer()],
        program.programId
      );

      const newMaximumRarity = new BN(mints.length + 10);

      await assertFail(
        program.rpc.setJungle(
          newMaximumRarity,
          newMaximumMultiplier,
          newWeekly,
          tree.getRootArray(),
          {
            accounts: {
              jungle: jungleAddress,
              owner: newOwner.publicKey,
              newOwner: newOwner.publicKey,
            },
            signers: [newOwner],
          }
        )
      );
    });
  });
