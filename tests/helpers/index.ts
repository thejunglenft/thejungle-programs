import assert from "assert";
import { web3, Provider, BN } from "@project-serum/anchor";

import {
  TOKEN_PROGRAM_ID,
  Token,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { MerkleTree } from "./merkleTree";

export const findAssociatedAddress = async (
  owner: web3.PublicKey,
  mint: web3.PublicKey
) => {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    owner,
    true
  );
};

export const assertFail = async (pendingTx: Promise<any>, error?: string) => {
  const log = console.log;
  console.log = () => {};
  let success = true;
  try {
    await pendingTx;
  } catch (err) {
    success = false;
    // log(err);
  } finally {
    console.log = log;
  }
  if (success) throw new Error("Should have failed");
};

export const airdropUsers = async (
  users: web3.Signer[],
  provider: Provider,
  options?: { amount?: number }
) => {
  await Promise.all(
    users.map(
      (keypair) =>
        new Promise(async (resolve) => {
          const airdrop = await provider.connection.requestAirdrop(
            keypair.publicKey,
            options?.amount || 5 * 10 ** 9
          );
          await provider.connection.confirmTransaction(airdrop);
          resolve(true);
        })
    )
  );
};

export const airdropNft: (
  user: web3.Signer,
  provider: Provider
) => Promise<[Token, web3.PublicKey]> = async (user, provider) => {
  let mint = await Token.createMint(
    provider.connection,
    user,
    user.publicKey,
    null,
    0,
    TOKEN_PROGRAM_ID
  );

  let account = await mint.createAccount(user.publicKey);

  await mint.mintTo(account, user, [], 1);

  return [mint, account];
};

export const merkleCollection = async (
  user: web3.Signer,
  amount: number,
  provider: Provider
) => {
  const mints = await Promise.all(
    Array(amount)
      .fill(0)
      .map(() =>
        Token.createMint(
          provider.connection,
          user,
          user.publicKey,
          null,
          0,
          TOKEN_PROGRAM_ID
        ).then(async (token) => {
          token.mintTo(
            (await token.getOrCreateAssociatedAccountInfo(user.publicKey))
              .address,
            user,
            [],
            1
          );
          return token;
        })
      )
  );

  const leaves = buildLeaves(
    mints.map((e, i) => ({
      mint: e.publicKey,
      rarity: i,
      faction: i % 8,
    }))
  );
  const tree = new MerkleTree(leaves);
  return {
    mints,
    tree,
  };
};

export const buildLeaves = (
  data: { mint: web3.PublicKey; rarity: number; faction: number }[]
) => {
  const leaves: Array<Buffer> = [];
  for (let idx = 0; idx < data.length; ++idx) {
    const animal = data[idx];
    leaves.push(
      Buffer.from([
        ...animal.mint.toBuffer(),
        ...new BN(animal.rarity).toArray("le", 8),
        ...new BN(animal.faction).toArray("le", 8),
      ])
    );
  }

  return leaves;
};

export const mintAndTransferRewards = async (
  provider: Provider,
  programId: web3.PublicKey,
  jungleKey: web3.PublicKey,
  owner: web3.Signer,
  amount: number
) => {
  let mint = await Token.createMint(
    provider.connection,
    owner,
    owner.publicKey,
    null,
    9,
    TOKEN_PROGRAM_ID
  );
  const [escrow, escrowBump] = await web3.PublicKey.findProgramAddress(
    [Buffer.from("escrow"), jungleKey.toBuffer()],
    programId
  );
  const [rewardsAccount, rewardsBump] = await web3.PublicKey.findProgramAddress(
    [Buffer.from("rewards"), jungleKey.toBuffer(), mint.publicKey.toBuffer()],
    programId
  );
  const ownerAccount = await mint.getOrCreateAssociatedAccountInfo(
    owner.publicKey
  );
  await mint.mintTo(ownerAccount.address, owner, [], amount * 10 ** 9);

  return { mint, rewardsAccount, ownerAccount };
};
