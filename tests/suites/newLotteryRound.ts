import { expect } from "chai";
import {
  setProvider,
  Provider,
  Program,
  workspace,
  BN,
  web3,
} from "@project-serum/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { Lottery } from "../../target/types/lottery";
import { airdropUsers, assertFail } from "../helpers";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const testNewLotteryRound = (provider: Provider) =>
  describe("New lottery round", () => {
    setProvider(provider);

    const program = workspace.Lottery as Program<Lottery>;

    let owner: Keypair, player: Keypair;
    let mintRewards: Token;
    let lotteryKey: PublicKey, treasury: PublicKey, playerAccount: PublicKey;

    const startingAmount = new BN(10 ** 10);
    const period = new BN(5);

    beforeEach(async () => {
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
      await mintRewards.mintTo(
        playerAccount,
        owner,
        [],
        startingAmount.toNumber()
      );

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

      const start = Math.round(Date.now() / 1000) - 6;

      await program.rpc.initializeLottery(bumps, period, new BN(start), {
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
      });
    });

    it("Start a new round", async () => {
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
          new BN(1).toBuffer("le", 8),
        ],
        program.programId
      );
      const [previousRound, previousRoundBump] =
        await PublicKey.findProgramAddress(
          [
            Buffer.from("round"),
            lotteryKey.toBuffer(),
            new BN(0).toBuffer("le", 8),
          ],
          program.programId
        );

      // Send money to the pot
      const potMoney = new BN(10 ** 9);
      web3.sendAndConfirmTransaction(
        provider.connection,
        new web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: owner.publicKey,
            toPubkey: escrow,
            lamports: potMoney.toNumber(),
          })
        ),
        [owner]
      );

      await program.rpc.newLotteryRound(roundBump, {
        accounts: {
          lottery: lotteryAddress,
          escrow: escrow,
          lotteryRound: round,
          oldLotteryRound: previousRound,
          payer: player.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [player],
      });

      let r = await program.account.lotteryRound.fetch(round);
      const pr = await program.account.lotteryRound.fetch(previousRound);

      expect(r.index.toNumber()).to.equal(1);
      expect(r.start.toString()).to.equal(pr.start.add(period).toString());
      expect(r.spendings.map((e) => e.toString()).toString()).to.equal(
        new Array(8).fill("0").toString()
      );
      expect(r.pot.toString()).to.equal(potMoney.toString());

      expect(pr.pot.toString()).to.equal(new BN(0).toString());
      expect(pr.winner).to.not.equal(0);

      // Not claiming anything and skipping more rounds should only give empty pots
      await new Promise(async (resolve) => setTimeout(resolve, 6000))

      const [nextRound, nextRoundBump] =
        await PublicKey.findProgramAddress(
          [
            Buffer.from("round"),
            lotteryKey.toBuffer(),
            new BN(2).toBuffer("le", 8),
          ],
          program.programId
        );

      await program.rpc.newLotteryRound(nextRoundBump, {
        accounts: {
          lottery: lotteryAddress,
          escrow: escrow,
          lotteryRound: nextRound,
          oldLotteryRound: round,
          payer: player.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [player],
      });

      r = await program.account.lotteryRound.fetch(round);
      const nr = await program.account.lotteryRound.fetch(nextRound);

      expect(r.index.toNumber()).to.equal(1);
      expect(r.start.toString()).to.equal(pr.start.add(period).toString());
      expect(r.spendings.map((e) => e.toString()).toString()).to.equal(
        new Array(8).fill("0").toString()
      );
      expect(r.pot.toString()).to.equal(potMoney.toString());
      expect(r.winner).to.not.equal(0);

      expect(nr.index.toNumber()).to.equal(2);
      expect(nr.start.toString()).to.equal(pr.start.add(period).add(period).toString());
      expect(nr.spendings.map((e) => e.toString()).toString()).to.equal(
        new Array(8).fill("0").toString()
      );
      expect(nr.pot.toString()).to.equal(new BN(0).toString());
      expect(nr.winner).to.equal(0);
    });

    it("Can't be triggered before the previous round is finished", async () => {
      const [lotteryAddress, lotteryBump] = await PublicKey.findProgramAddress(
        [Buffer.from("lottery"), lotteryKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow"), lotteryKey.toBuffer()],
        program.programId
      );
      const [nextRound, nextRoundBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("round"),
          lotteryKey.toBuffer(),
          new BN(2).toBuffer("le", 8),
        ],
        program.programId
      );
      const [round, roundBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("round"),
          lotteryKey.toBuffer(),
          new BN(1).toBuffer("le", 8),
        ],
        program.programId
      );
      const [previousRound, previousRoundBump] =
        await PublicKey.findProgramAddress(
          [
            Buffer.from("round"),
            lotteryKey.toBuffer(),
            new BN(0).toBuffer("le", 8),
          ],
          program.programId
        );

      // Send money to the pot
      const potMoney = new BN(10 ** 9);
      web3.sendAndConfirmTransaction(
        provider.connection,
        new web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: owner.publicKey,
            toPubkey: escrow,
            lamports: potMoney.toNumber(),
          })
        ),
        [owner]
      );

      await program.rpc.newLotteryRound(roundBump, {
        accounts: {
          lottery: lotteryAddress,
          escrow: escrow,
          lotteryRound: round,
          oldLotteryRound: previousRound,
          payer: player.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [player],
      });

      await assertFail(
        program.rpc.newLotteryRound(nextRoundBump, {
          accounts: {
            lottery: lotteryAddress,
            escrow: escrow,
            lotteryRound: nextRound,
            oldLotteryRound: round,
            payer: player.publicKey,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [player],
        })
      );
    });
  });
