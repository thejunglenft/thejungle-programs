use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{Jungle, Animal};

#[derive(Accounts)]
pub struct ClaimStaking<'info> {
    /// The jungle state
    #[account(
        seeds = [
            b"jungle",
            jungle.key.as_ref()
        ],
        bump = jungle.bumps.jungle,
        has_one = mint,
        has_one = rewards_account
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

    /// The staking account
    #[account(
        mut,
        seeds = [
            b"animal".as_ref(),
            animal.mint.as_ref()
        ],
        bump = animal.bumps.animal,
        has_one = staker
    )]
    pub animal: Account<'info, Animal>,

    /// The owner of the staked token
    #[account(mut)]
    pub staker: Signer<'info>,

    /// The mint of the reward token
    #[account(mut)]
    pub mint: AccountInfo<'info>,

    /// The user account receiving rewards
    #[account(
        mut, 
        constraint = 
            staker_account.owner == staker.key() &&
            staker_account.mint == mint.key()
    )]
    pub staker_account: Account<'info, TokenAccount>,

    /// The account that will hold the token being staked
    #[account(
        mut,
        seeds = [
            b"rewards",
            jungle.key.as_ref(),
            jungle.mint.as_ref()
        ],
        bump = jungle.bumps.rewards,
    )]
    pub rewards_account: Account<'info, TokenAccount>,

    /// The program for interacting with the token
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,

    /// Clock account used to know the time
    pub clock: Sysvar<'info, Clock>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

/// Claims rewards for a staked token
pub fn handler(ctx: Context<ClaimStaking>) -> ProgramResult {
    let jungle = &ctx.accounts.jungle;
    let animal = &mut ctx.accounts.animal;

    let rarity = if animal.rarity <= jungle.maximum_rarity { animal.rarity } else { jungle.maximum_rarity };
    let multiplier = 10000 + (jungle.maximum_rarity_multiplier - 10000) * rarity / jungle.maximum_rarity;
    let seconds_elapsed = ctx.accounts.clock.unix_timestamp - animal.last_claim;
    let weekly_emissions = jungle.base_weekly_emissions * multiplier / 10000;
    let rewards_amount = weekly_emissions * (seconds_elapsed as u64) / 604800 / jungle.animals_staked;
    
    animal.last_claim = ctx.accounts.clock.unix_timestamp;

    let seeds = &[
        b"escrow".as_ref(),
        jungle.key.as_ref(),
        &[jungle.bumps.escrow],
    ];
    let signer = &[&seeds[..]];

    let context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.rewards_account.to_account_info(),
            to: ctx.accounts.staker_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer,
    );
    token::transfer(context, rewards_amount)?;

    msg!("Rewards claimed");

    Ok(())
}
