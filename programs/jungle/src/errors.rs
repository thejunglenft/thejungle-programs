use anchor_lang::error;

#[error]
pub enum ErrorCode {
    #[msg("Invalid multiplier, must be greater than 10000")]
    InvalidMultiplier,

    #[msg("Too early to stake")]
    TooEarly,

    #[msg("Merkle proof is invalid")]
    InvalidProof,
}
