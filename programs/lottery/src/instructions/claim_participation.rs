use anchor_lang::prelude::*;

use crate::errors::*;
use crate::{Lottery, LotteryParticipation, LotteryRound};

#[derive(Accounts)]
pub struct ClaimParticipation<'info> {
    /// The lottery
    #[account(
        mut,
        seeds = [
            b"lottery", 
            lottery.key.as_ref()
        ],
        bump = lottery.bumps.lottery,
    )]
    pub lottery: Account<'info, Lottery>,

    /// The account holding the winning pot
    #[account(
        mut,
        seeds = [
            b"escrow",
            lottery.key.as_ref()
        ],
        bump = lottery.bumps.escrow
    )]
    pub escrow: AccountInfo<'info>,

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
        mut,
        close = player,
        seeds = [
            b"participation",
            lottery.key.as_ref(),
            lottery_round.index.to_le_bytes().as_ref(),
            player.key().as_ref()
        ],
        bump = participation.bump
    )]
    pub participation: Account<'info, LotteryParticipation>,

    /// The owner of the token being staked
    #[account(mut)]
    pub player: Signer<'info>,

    /// Clock account used to know the time
    pub clock: Sysvar<'info, Clock>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

/// Claims winnings and close account
pub fn handler(ctx: Context<ClaimParticipation>) -> ProgramResult {
    let lottery = &mut ctx.accounts.lottery;
    let lottery_round = &mut ctx.accounts.lottery_round;
    if ctx.accounts.clock.unix_timestamp <= lottery_round.start + lottery.period as i64
        && lottery.last_round > lottery_round.index
    {
        return Err(ErrorCode::RoundNotFinished.into());
    }

    let participation = &ctx.accounts.participation;
    let index_winner = (lottery_round.winner - 1) as usize;
    let amount = if lottery_round.spendings[index_winner] != 0 { 
        lottery_round.pot * participation.spendings[index_winner] / lottery_round.spendings[index_winner]
    } else {
        0
    };

    // Cap the amount to the balance of the pot
    lottery_round.pot -= if amount < lottery_round.pot {
        amount
    } else {
        lottery_round.pot
    };

    lottery.unclaimed_pot -= amount;

    // Transfer to the claimant
    let seeds = &[
        b"escrow".as_ref(),
        lottery.key.as_ref(),
        &[lottery.bumps.escrow],
    ];
    let signer = &[&seeds[..]];
    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.escrow.key,
        &ctx.accounts.player.key,
        amount,
    );
    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.player.to_account_info(),
        ],
        signer,
    )?;

    msg!("Participation updated");

    Ok(())
}
