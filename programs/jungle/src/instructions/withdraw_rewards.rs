use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::Jungle;

#[derive(Accounts)]
pub struct WithdrawRewards<'info> {
    /// The Jungle
    #[account(
        seeds = [
            b"jungle",
            jungle.key.as_ref()
        ],
        bump = jungle.bumps.jungle,
        has_one = rewards_account,
        has_one = owner
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

    /// The mint of the staking token
    pub mint: AccountInfo<'info>,

    /// The account that will hold the exhibition token
    #[account(
        mut,
        seeds = [
            b"rewards".as_ref(),
            jungle.key.as_ref(),
            mint.key().as_ref()
        ],
        bump = jungle.bumps.rewards
    )]
    pub rewards_account: Account<'info, TokenAccount>,

    /// The wallet that will own the jungle
    pub owner: Signer<'info>,

    /// The old staking rewards account
    #[account(
        mut,
        has_one = mint,
        constraint = owner_account.owner == owner.key()
    )]
    pub owner_account: Account<'info, TokenAccount>,

    /// The program for interacting with the token.
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
}

/// Lets owner withdraw some rewards from the escrow without changing the token
pub fn handler(ctx: Context<WithdrawRewards>, amount: u64) -> ProgramResult {
    let jungle = &ctx.accounts.jungle;

    // Transfer all tokens left to the owner
    let seeds = &[
        b"escrow".as_ref(),
        jungle.key.as_ref(),
        &[jungle.bumps.escrow],
    ];
    let signer = &[&seeds[..]];
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.rewards_account.to_account_info(),
            to: ctx.accounts.owner_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer,
    );
    token::transfer(transfer_ctx, amount)?;

    msg!("Rewards withdrawn");

    Ok(())
}
