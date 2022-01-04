use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::*;
use crate::{Lottery, LotteryParticipation, LotteryRound};

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Participate<'info> {
    /// The lottery
    #[account(
        seeds = [
            b"lottery",
            lottery.key.as_ref()
        ],
        bump = lottery.bumps.lottery,
        has_one = treasury,
    )]
    pub lottery: Account<'info, Lottery>,

    /// The lottery round
    #[account(
        mut,
        seeds = [
            b"round",
            lottery.key.as_ref(),
            lottery_round.index.to_le_bytes().as_ref()
        ],
        bump = lottery_round.bump,
    )]
    pub lottery_round: Account<'info, LotteryRound>,

    /// The lottery participation
    #[account(
        init,
        payer = player,
        seeds = [
            b"participation",
            lottery.key.as_ref(),
            lottery_round.index.to_le_bytes().as_ref(),
            player.key().as_ref()
        ],
        bump = bump,
    )]
    pub participation: Account<'info, LotteryParticipation>,

    /// The owner of the token being staked
    #[account(mut)]
    pub player: Signer<'info>,

    /// The user account that spends rewards
    #[account(
        mut,
        constraint = 
            player_account.owner == player.key() &&
            player_account.mint == treasury.mint
    )]
    pub player_account: Account<'info, TokenAccount>,

    /// The account that will hold the token being staked
    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    /// The program for interacting with the token
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,

    /// Clock account used to know the time
    pub clock: Sysvar<'info, Clock>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

impl<'info> Participate<'info> {
    fn transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.player_account.to_account_info(),
                to: self.treasury.to_account_info(),
                authority: self.player.to_account_info(),
            },
        )
    }
}

/// Spends staking rewards on a faction to play the lottery
pub fn handler(ctx: Context<Participate>, bump: u8, spendings: [u64; 8]) -> ProgramResult {
    let lottery = &ctx.accounts.lottery;
    let lottery_round = &mut ctx.accounts.lottery_round;
    if ctx.accounts.clock.unix_timestamp > lottery_round.start + lottery.period as i64 {
        return Err(ErrorCode::RoundFinished.into());
    }

    let participation = &mut ctx.accounts.participation;
    participation.bump = bump;
    participation.index = lottery_round.index;
    participation.player = ctx.accounts.player.key();

    let mut sum = 0;
    for i in 0..spendings.len() {
        sum += spendings[i];
        lottery_round.spendings[i] += spendings[i];
        participation.spendings[i] += spendings[i];
    }

    token::transfer(ctx.accounts.transfer_context(), sum)?;

    msg!("Lottery entered");

    Ok(())
}
