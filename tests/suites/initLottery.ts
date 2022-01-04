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
import { Lottery } from "../../target/types/lottery";
import {
  airdropUsers,
} from "../helpers";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const testInitializeLottery = (
  provider: Provider
) =>
  describe("Initializing the lottery", () => {
    setProvider(provider);

    const program = workspace.Lottery as Program<Lottery>;

    let owner: Keypair, player: Keypair;
    let mintRewards: Token;
    let lotteryKey: PublicKey, treasury: PublicKey, playerAccount: PublicKey;

    const startingAmount = new BN(10 ** 10);
    const period = new BN(5)

    before(async () => {
      owner = Keypair.generate();
      player = Keypair.generate();
      await airdropUsers([owner, player], provider);

      mintRewards = await Token.createMint(
        provider.connection,
        owner,
        owner.publicKey,
        null,
        9,
        TOKEN_PROGRAM_ID
      );
      treasury = (
        await mintRewards.getOrCreateAssociatedAccountInfo(owner.publicKey)
      ).address;
      playerAccount = (
        await mintRewards.getOrCreateAssociatedAccountInfo(player.publicKey)
      ).address;
      lotteryKey = Keypair.generate().publicKey;
      await mintRewards.mintTo(playerAccount, owner, [], startingAmount.toNumber());
    });

    it("Initializes the lottery", async () => {
      const [lotteryAddress, lotteryBump] = await PublicKey.findProgramAddress(
        [Buffer.from("lottery"), lotteryKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow"), lotteryKey.toBuffer()],
        program.programId
      );
      const [round, roundBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("round"),
          lotteryKey.toBuffer(),
          new BN(0).toBuffer("le", 8),
        ],
        program.programId
      );

      const bumps = {
        lottery: lotteryBump,
        escrow: escrowBump,
        round: roundBump,
      };

      const start = Math.round(Date.now() / 1000)

      await program.rpc.initializeLottery(
        bumps,
        period,
        new BN(start),
        {
          accounts: {
            lotteryKey: lotteryKey,
            lottery: lotteryAddress,
            lotteryRound: round,
            escrow: escrow,
            mint: mintRewards.publicKey,
            treasury: treasury,
            owner: owner.publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [owner],
        }
      );

      const s = await program.account.lottery.fetch(lotteryAddress);

      expect(s.owner.toString()).to.equal(owner.publicKey.toString());
      expect(s.key.toString()).to.equal(lotteryKey.toString());
      expect(s.mint.toString()).to.equal(mintRewards.publicKey.toString());
      expect(s.escrow.toString()).to.equal(escrow.toString());
      expect(s.mint.toString()).to.equal(mintRewards.publicKey.toString());
      expect(s.period.toString()).to.equal(period.toString());
      expect(s.treasury.toString()).to.equal(treasury.toString());
    });
  });
