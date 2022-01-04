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
  airdropUsers, assertFail,
} from "../helpers";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const testSetLottery = (
  provider: Provider
) =>
  describe("Set the lottery", () => {
    setProvider(provider);

    const program = workspace.Lottery as Program<Lottery>;

    let owner: Keypair, otherOwner: Keypair, player: Keypair;
    let mintRewards: Token;
    let lotteryKey: PublicKey, otherLotteryKey: PublicKey, treasury: PublicKey, playerAccount: PublicKey;

    const startingAmount = new BN(10 ** 10);
    const period = new BN(5)

    before(async () => {
      owner = Keypair.generate();
      otherOwner = Keypair.generate();
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

      otherLotteryKey = Keypair.generate().publicKey;
      const [lottery2Address, lottery2Bump] = await PublicKey.findProgramAddress(
        [Buffer.from("lottery"), otherLotteryKey.toBuffer()],
        program.programId
      );
      const [escrow2, escrow2Bump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow"), otherLotteryKey.toBuffer()],
        program.programId
      );
      const [round2, round2Bump] = await PublicKey.findProgramAddress(
        [
          Buffer.from("round"),
          otherLotteryKey.toBuffer(),
          new BN(0).toBuffer("le", 8),
        ],
        program.programId
      );

      const bumps2 = {
        lottery: lottery2Bump,
        escrow: escrow2Bump,
        round: round2Bump,
      };

      await program.rpc.initializeLottery(
        bumps2,
        period,
        new BN(start),
        {
          accounts: {
            lotteryKey: otherLotteryKey,
            lottery: lottery2Address,
            lotteryRound: round2,
            escrow: escrow2,
            mint: mintRewards.publicKey,
            treasury: treasury,
            owner: owner.publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
          signers: [owner],
        }
      );
    });

    it("Sets the lottery", async () => {
      const [lotteryAddress, lotteryBump] = await PublicKey.findProgramAddress(
        [Buffer.from("lottery"), lotteryKey.toBuffer()],
        program.programId
      );
      const [escrow, escrowBump] = await PublicKey.findProgramAddress(
        [Buffer.from("escrow"), lotteryKey.toBuffer()],
        program.programId
      );

      const start = Math.round(Date.now() / 1000)
      const newMint = Keypair.generate().publicKey
      const newTreasury = Keypair.generate().publicKey
      const newPeriod = new BN(10000)

      await program.rpc.setLottery(
        new BN(start+1),
        player.publicKey,
        newMint,
        newTreasury,
        newPeriod,
        {
          accounts: {
            lottery: lotteryAddress,
            owner: owner.publicKey,
          },
          signers: [owner],
        }
      );

      const s = await program.account.lottery.fetch(lotteryAddress);

      console.log(owner.publicKey.toString(), player.publicKey.toString())

      expect(s.key.toString()).to.equal(lotteryKey.toString());
      expect(s.owner.toString()).to.equal(player.publicKey.toString());
      expect(s.mint.toString()).to.equal(newMint.toString());
      expect(s.escrow.toString()).to.equal(escrow.toString());
      expect(s.period.toString()).to.equal(newPeriod.toString());
      expect(s.treasury.toString()).to.equal(newTreasury.toString());
      expect(s.lastTimestamp.toNumber()).to.equal(start+1);
    });

    it("Fails when not called by the owner", async () => {
      const [lotteryAddress, lotteryBump] = await PublicKey.findProgramAddress(
        [Buffer.from("lottery"), otherLotteryKey.toBuffer()],
        program.programId
      );

      const start = Math.round(Date.now() / 1000)
      const newMint = Keypair.generate().publicKey
      const newTreasury = Keypair.generate().publicKey
      const newPeriod = new BN(10000)

      await assertFail(program.rpc.setLottery(
        new BN(start+1),
        player.publicKey,
        newMint,
        newTreasury,
        newPeriod,
        {
          accounts: {
            lottery: lotteryAddress,
            owner: otherOwner.publicKey,
          },
          signers: [otherOwner],
        }
      ));
    });
  });
