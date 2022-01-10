import fs from "fs";
import {
  Program,
  Provider,
  setProvider,
  web3,
  Wallet,
} from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

import key from "../key.json";
import deployment from "../deployment.json";
import { Lottery, IDL as LotteryIDL } from "../target/types/lottery";
import lotteryIdl from "../target/idl/lottery.json";

const transferPot = async (endpoint: string, amount: string) => {
  if (!endpoint) throw new Error("Missing endpoint argument");

  const connection = new web3.Connection(endpoint);
  const wallet = new Wallet(web3.Keypair.fromSecretKey(Uint8Array.from(key)));
  const provider = new Provider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  setProvider(provider);

  const lotteryProgram = new Program<Lottery>(
    LotteryIDL,
    lotteryIdl.metadata.address,
    provider
  );

  const [lotteryAddress] = await PublicKey.findProgramAddress(
    [
      Buffer.from("lottery", "utf8"),
      new PublicKey(deployment.lotteryKey).toBuffer(),
    ],
    lotteryProgram.programId
  );

  const lottery = await lotteryProgram.account.lottery.fetch(lotteryAddress);

  // Transfer the reward token
  provider.connection.sendTransaction(
    new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: lottery.escrow,
        lamports: Number(amount),
      })
    ),
    [wallet.payer]
  );
};

transferPot(process.argv[2], process.argv[3]);
