const fs = require("fs");
const anchor = require("@project-serum/anchor");
import { BN } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { buildLeaves } from "../tests/helpers";
import { MerkleTree } from "../tests/helpers/merkleTree";

const idl = require("../target/idl/stead_rent.json");

module.exports = async function (provider) {
  anchor.setProvider(provider);

  const program = new anchor.Program(idl, idl.metadata.address, provider);

  const jungleKey = Keypair.generate().publicKey;
  const maxMultiplier = new BN(20000);
  const maxRarity = new BN(1000);
  const baseWeeklyEmissions = new BN(604800).mul(new BN(10 ** 9));

  const leaves = buildLeaves(
    mints.map((e, i) => ({
      mint: e.publicKey,
      rarity: i,
      faction: i % 8,
    }))
  );
  const tree = new MerkleTree(leaves);

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

  console.log("Jungle key:", jungleKey.toString());
  console.log("Owner:", provider.wallet.publicKey.toString());
  console.log("Program ID:", program.programId.toString());
  console.log("Jungle:", jungleAddress.toString());
  console.log("Escrow:", escrow.toString());

  try {
    await program.rpc.initializeJungle(
      bumps,
      maxRarity,
      maxMultiplier,
      baseWeeklyEmissions,
      tree.getRootArray(),
      {
        accounts: {
          jungleKey: jungleKey,
          jungle: jungleAddress,
          escrow: escrow,
          mint: mintRewards.publicKey,
          rewardsAccount: rewards,
          owner: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        signers: [provider.wallet],
      }
    );
  } catch (err) {
    console.log("State alredy existed? Trying to set it instead...");
    console.log(err);
  }

  fs.writeFileSync(
    "../deployment.json",
    JSON.stringify(
      {
        programKey: idl.metadata.address.toString(),
        jungleKey: jungleKey.toString(),
        escrowKey: escrow.toString()
      },
      null,
      2
    )
  );
};
