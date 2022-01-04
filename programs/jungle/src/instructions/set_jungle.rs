use anchor_lang::prelude::*;

use crate::{errors::ErrorCode, Jungle};

#[derive(Accounts)]
pub struct SetJungle<'info> {
    /// The Jungle
    #[account(
        mut,
        has_one = owner,
    )]
    pub jungle: Account<'info, Jungle>,

    /// The wallet that owns the jungle
    pub owner: Signer<'info>,
    
    /// The wallet that will own the jungle
    pub new_owner: AccountInfo<'info>,
}

/// Sets the jungle parameters
pub fn handler(
    ctx: Context<SetJungle>,
    max_rarity: u64,
    max_multiplier: u64,
    base_weekly_emissions: u64,
    start: i64,
    root: [u8; 32],
) -> ProgramResult {
    if max_multiplier < 10000 {
        return Err(ErrorCode::InvalidMultiplier.into())
    }

    let jungle = &mut ctx.accounts.jungle;
    jungle.owner = ctx.accounts.new_owner.key();
    jungle.maximum_rarity = max_rarity;
    jungle.maximum_rarity_multiplier = max_multiplier;
    jungle.base_weekly_emissions = base_weekly_emissions;
    jungle.start = start;
    jungle.root = root;

    msg!("Jungle set");

    Ok(())
}
