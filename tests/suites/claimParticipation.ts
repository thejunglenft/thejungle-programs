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

export const testClaimParticipation = (provider: Provider) =>
  describe("Claim the rewards for a round", () => {
    setProvider(provider);

    const program = workspace.Lottery as Program<Lottery>;

    let owner: Keypair, player: Keypair;
    let mintRewards: Token;
    let lotteryKey: PublicKey, treasury: PublicKey, playerAccount: PublicKey;

    const startingAmount = new BN(10 ** 10);
    const period = new BN(3);

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

      const [nextRound, nextRoundBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("round"),
          lotteryKey.toBuffer(),
          new BN(1).toBuffer("le", 8),
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
    });

    it("Claim the rewards", async () => {
      const [lotteryAddress, lotteryBump] = await PublicKey.findProgramAddress(
        [Buffer.from("lottery"), lotteryKey.toBuffer()],
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
      const [participation, participationBump] =
        await PublicKey.findProgramAddress(
          [
            Buffer.from("participation"),
            lotteryKey.toBuffer(),
            new BN(1).toBuffer("le", 8),
            player.publicKey.toBytes(),
          ],
          program.programId
        );

      const spendings = Array(8)
        .fill(10 ** 9)
        .map((e) => new BN(e));

      await program.rpc.participate(participationBump, spendings, {
        accounts: {
          lottery: lotteryAddress,
          lotteryRound: round,
          participation: participation,
          player: player.publicKey,
          playerAccount: playerAccount,
          treasury: treasury,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [player],
      });

      // Wait for the next round
      await new Promise(async (resolve) => setTimeout(resolve, 3000));

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

      // Start the next round
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

      const balanceBefore = await provider.connection.getBalance(
        player.publicKey
      );

      await program.rpc.claimParticipation({
        accounts: {
          lottery: lotteryAddress,
          escrow: escrow,
          lotteryRound: round,
          participation: participation,
          player: player.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [player],
      });

      const r = await program.account.lotteryRound.fetch(round);

      expect(r.pot.toString()).to.equal(new BN(0).toString());

      expect(
        (await provider.connection.getBalance(player.publicKey)) > balanceBefore
      ).to.true;
    });
  });
