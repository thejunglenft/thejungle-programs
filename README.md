# The Jungle NFT Staking Programs

[The Jungle](https://thejunglenft.com/) is a collection of 1,555 pixel animals living on Solana blockchain. With over 50 unique characters belonging to 8 factions, our aim is to bring together the many DAOs in the Solana eco-system through co-operation, competition, staking rewards and striving to make a positive change in the world.

The repository contains the code of the staking programs.

## Overview

The program is composed of two main components.

The Staking module lets holders of the Jungle NFTs deposit their tokens in a program-owned account in exchange for rewards.  It lets users:
- Deposit their NFT in a secured program-owned account. To prevent creating manually each token account, the Merkle verification of [Gumdrop](https://github.com/metaplex-foundation/metaplex/tree/master/rust/gumdrop) is reused.
- Collect rewards, paid $ANIMAL, based on the rarity of the NFT. The rarest NFT can earn up to XX% more rewards than the least rare. The rewards rate is fixed and more people coming to stake will decrease individuals' rewards.
- Withdraw their NFT.

The Lottery module lets users spend $ANIMAL to participate in a weekly lottery, where the winning pot is the royalties collected during the week. It lets users:
- Participate by spending $ANIMAL on their favorite Faction of the Jungle. A player can spend $ANIMAL on every faction in any quantity desired. However all spending are final and can never be withdrawn. The collected amount is pooled back in the rewards. Participations are reset every week when a new round begins.
- Collect rewards of the round that just finished. Rewards can be collected at any time after the round finished and the winning faction has been drawn. The total amount available to collect depends on what was present in the pot, minus all outstanding withdrawals of players who did not claim their rewards. This amount is shared between all the players that spent tokens in this faction.