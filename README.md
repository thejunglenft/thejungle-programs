# The Jungle NFT Staking Programs

[The Jungle](https://thejunglenft.com/) is a collection of 1,555 pixel animals living on Solana blockchain. With over 50 unique characters belonging to 8 factions, our aim is to bring together the many DAOs in the Solana eco-system through co-operation, competition, staking rewards and striving to make a positive change in the world.

The repository contains the code of the staking programs.

## Overview

The program is composed of two main components.

The Staking module lets holders of the Jungle NFTs deposit their tokens in a program-owned account in exchange for rewards. It lets users:

- Deposit their NFT in a secured program-owned account. To prevent creating manually each token account, the Merkle verification of [Gumdrop](https://github.com/metaplex-foundation/metaplex/tree/master/rust/gumdrop) is reused.
- Collect rewards, paid $ANIMAL, based on the rarity of the NFT. The rarest NFT can earn up to XX% more rewards than the least rare. The rewards rate is fixed and more people coming to stake will decrease individuals' rewards.
- Withdraw their NFT.

The Lottery module lets users spend $ANIMAL to participate in a weekly lottery, where the winning pot is the royalties collected during the week. It lets users:

- Participate by spending $ANIMAL on their favorite Faction of the Jungle. A player can spend $ANIMAL on every faction in any quantity desired. However all spending are final and can never be withdrawn. The collected amount is pooled back in the rewards. Participations are reset every week when a new round begins.
- Collect rewards of the round that just finished. Rewards can be collected at any time after the round finished and the winning faction has been drawn. The total amount available to collect depends on what was present in the pot, minus all outstanding withdrawals of players who did not claim their rewards. This amount is shared between all the players that spent tokens in this faction.

The Jungle staking program's ID is **8XgPs7DNb7jvZqu5Y6zbF1idvrXnLtHZK4kVGKALd9fS**, the lottery's is **6LUNT8JqxCKFw7u1R1PP2wgDTdgYskwGGFK1azVuzJZC**.

## Usage

### As an NFT holder

1. Stake your tokens
2. Claim your rewards
3. Spend your staking rewards to bet on a factions each week
4. Claim rewards if a faction you bet on won the lottery round

### As an admin

The amount of SOL winnable in the lottery depends on what is deposited in the lottery account at the time the round starts. As admins, you HAVE TO send SOL manually each week.

*Currently, the lottery account's address is **65dhKKXK1K1vaHXiev5cNMTWwoSL1nJABB63kDZnx2gj**.*

The owner of the Jungle can withdraw staking rewards at any time using the `jungleProgram.rpc.withdrawRewards` method. This allows migrating to a new program or using rewards for the team's operations. Attention, THE OWNER CAN WITHDRAW ALL REWARDS at any time. This means that staking rewards can sto pand the owners can dump the tokens as long as there is an owner.

### As a developer

- Deploy the program using `yarn deploy:mainnet` or `yarn deploy:devnet`. This uploads to program on the solana blockchain. To work, you need to have a `key.json` file at the root of this folder (create one using `solana-keygen new -o key.json`) and this account must have enough to pay rent (~10 SOL).
- Initialize the program with `yarn initialize:mainnet` or `yarn initialize:devnet`. This costs less SOL but some is needed to sign the transactions. You need to update the values defined `config.json` first. This creates a Jungle staking and it's associated reward token, sends half of the supply to the staking rewards account, creates a lottery that uses the rewards token and sets the staking rewards account as the beneficiary for the spent lottery tickets.
