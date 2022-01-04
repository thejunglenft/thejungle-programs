use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{Jungle, Animal, StakeAnimalBumps};
use crate::merkle_proof;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(bumps: StakeAnimalBumps)]
pub struct StakeAnimal<'info> {
    /// The jungle state
    #[account(
        mut,
        seeds = [
            b"jungle",
            jungle.key.as_ref()
        ],
        bump = jungle.bumps.jungle
    )]
    pub jungle: Account<'info, Jungle>,

    /// The account holding staking tokens, staking rewards and community funds
    #[account(
        mut,
        seeds = [
            b"escrow",
            jungle.key.as_ref()
        ],
        bump = jungle.bumps.escrow
    )]
    pub escrow: AccountInfo<'info>,

    /// The created staking account
    /// Doesn't use jungle.key as one token can only be staked once 
    #[account(
        init,
        payer = staker,
        seeds = [
            b"animal",
            mint.key().as_ref()
        ],
        bump = bumps.animal,
    )]
    pub animal: Account<'info, Animal>,

    /// The owner of the token being staked
    #[account(mut)]
    pub staker: Signer<'info>,

    /// The mint of the token being staked
    #[account(mut)]
    pub mint: AccountInfo<'info>,

    /// The user account that holds the NFT
    #[account(
        mut, 
        has_one = mint,
        constraint = staker_account.owner == staker.key()
    )]
    pub staker_account: Account<'info, TokenAccount>,

    /// The account that will hold the token being staked
    /// Doesn't use jungle.key as one token can only be staked once
    #[account(
        init,
        payer = staker,
        seeds = [
            b"deposit",
            mint.key().as_ref()
        ],
        bump = bumps.deposit,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub deposit_account: Account<'info, TokenAccount>,

    /// The program for interacting with the token
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,

    /// Clock account used to know the time
    pub clock: Sysvar<'info, Clock>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

impl<'info> StakeAnimal<'info> {
    fn transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.staker_account.to_account_info(),
                to: self.deposit_account.to_account_info(),
                authority: self.staker.to_account_info(),
            },
        )
    }
}

/// Buys a token from the exhibition and split revenues
pub fn handler(
    ctx: Context<StakeAnimal>,
    bumps: StakeAnimalBumps,
    proof: Vec<[u8; 32]>,
    rarity: u64,
    faction: u64
) -> ProgramResult {
    let jungle = &mut ctx.accounts.jungle;

    // Check that staking started
    if jungle.start > ctx.accounts.clock.unix_timestamp {
        return Err(ErrorCode::TooEarly.into());
    }

    // Verify the merkle leaf
    let node = solana_program::keccak::hashv(&[
        &[0x00],
        &ctx.accounts.mint.key().to_bytes(),
        &rarity.to_le_bytes(),
        &faction.to_le_bytes(),
    ]);
    if !merkle_proof::verify(proof, jungle.root, node.0) {
        return Err(ErrorCode::InvalidProof.into());
    }

    jungle.animals_staked += 1;

    let animal = &mut ctx.accounts.animal;
    animal.bumps = bumps;
    animal.mint = ctx.accounts.mint.key();
    animal.staker = ctx.accounts.staker.key();
    animal.last_claim = ctx.accounts.clock.unix_timestamp;
    animal.rarity = rarity;
    animal.faction = faction as u8;

    token::transfer(ctx.accounts.transfer_context(), 1)?;

    msg!("Token staked");

    Ok(())
}
