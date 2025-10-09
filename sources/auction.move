module 0x0::auction;

use nft_marketplace::nft_marketplace::{Self, SimpleNFT};
use std::string::String;
use sui::coin::{Self, Coin};
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::tx_context::{Self, TxContext};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};

// Error constants
const E_AUCTION_NOT_FOUND: u64 = 1;
const E_AUCTION_ENDED: u64 = 2;
const E_AUCTION_NOT_ENDED: u64 = 3;
const E_BID_TOO_LOW: u64 = 4;
const E_NOT_AUCTION_CREATOR: u64 = 5;
const E_CANNOT_BID_ON_OWN_AUCTION: u64 = 6;
const E_AUCTION_DURATION_TOO_SHORT: u64 = 7;

// Constants
const MIN_AUCTION_DURATION: u64 = 3600000; // 1 hour in milliseconds
const MAX_AUCTION_DURATION: u64 = 604800000; // 7 days in milliseconds

public struct Auction has store {
    id: ID,
    nft: SimpleNFT,
    seller: address,
    starting_price: u64,
    current_bid: u64,
    highest_bidder: Option<address>,
    end_time: u64,
    created_at: u64,
}

public struct AuctionHouse has key {
    id: UID,
    auctions: Table<ID, Auction>,
    held_bids: Table<address, Balance<SUI>>, // Hold previous bids for refund
    total_auctions: u64,
    completed_auctions: u64,
}

public struct AuctionStats has copy, drop {
    total_auctions: u64,
    active_auctions: u64,
    completed_auctions: u64,
}

// Initialize the auction house
fun init(ctx: &mut TxContext) {
    let auction_house = AuctionHouse {
        id: object::new(ctx),
        auctions: table::new(ctx),
        held_bids: table::new(ctx),
        total_auctions: 0,
        completed_auctions: 0,
    };
    transfer::share_object(auction_house);
}

// Create a new auction
public entry fun create_auction(
    auction_house: &mut AuctionHouse,
    nft: SimpleNFT,
    starting_price: u64,
    duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(duration_ms >= MIN_AUCTION_DURATION, E_AUCTION_DURATION_TOO_SHORT);
    assert!(duration_ms <= MAX_AUCTION_DURATION, E_AUCTION_DURATION_TOO_SHORT);
    
    let current_time = clock::timestamp_ms(clock);
    let nft_id = object::id(&nft);
    let seller = tx_context::sender(ctx);
    
    let auction = Auction {
        id: nft_id,
        nft,
        seller,
        starting_price,
        current_bid: starting_price,
        highest_bidder: option::none(),
        end_time: current_time + duration_ms,
        created_at: current_time,
    };

    table::add(&mut auction_house.auctions, nft_id, auction);
    auction_house.total_auctions = auction_house.total_auctions + 1;
}

// Place a bid on an auction
public entry fun place_bid(
    auction_house: &mut AuctionHouse,
    auction_id: ID,
    mut bid_coin: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&auction_house.auctions, auction_id), E_AUCTION_NOT_FOUND);
    
    let auction = table::borrow_mut(&mut auction_house.auctions, auction_id);
    let current_time = clock::timestamp_ms(clock);
    let bidder = tx_context::sender(ctx);
    
    assert!(current_time < auction.end_time, E_AUCTION_ENDED);
    assert!(bidder != auction.seller, E_CANNOT_BID_ON_OWN_AUCTION);
    
    let bid_amount = coin::value(&bid_coin);
    assert!(bid_amount > auction.current_bid, E_BID_TOO_LOW);
    
    // Refund previous highest bidder if exists
    if (option::is_some(&auction.highest_bidder)) {
        let prev_bidder = *option::borrow(&auction.highest_bidder);
        if (table::contains(&auction_house.held_bids, prev_bidder)) {
            let prev_bid = table::remove(&mut auction_house.held_bids, prev_bidder);
            let refund_coin = coin::from_balance(prev_bid, ctx); 
            transfer::public_transfer(refund_coin, prev_bidder);
        };
    };
    
    // Store new bid
    auction.current_bid = bid_amount;
    auction.highest_bidder = option::some(bidder);
    
    let bid_balance = coin::into_balance(bid_coin);
    if (table::contains(&auction_house.held_bids, bidder)) {
        let mut existing_balance = table::remove(&mut auction_house.held_bids, bidder);
        balance::join(&mut existing_balance, bid_balance);
        table::add(&mut auction_house.held_bids, bidder, existing_balance);
    } else {
        table::add(&mut auction_house.held_bids, bidder, bid_balance);
    };
}

// Finalize auction (anyone can call this after auction ends)
public entry fun finalize_auction(
    auction_house: &mut AuctionHouse,
    auction_id: ID,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&auction_house.auctions, auction_id), E_AUCTION_NOT_FOUND);
    
    let current_time = clock::timestamp_ms(clock);
    let auction = table::remove(&mut auction_house.auctions, auction_id);
    
    assert!(current_time >= auction.end_time, E_AUCTION_NOT_ENDED);
    
    let Auction {
        id: _,
        nft,
        seller,
        starting_price: _,
        current_bid,
        highest_bidder,
        end_time: _,
        created_at: _,
    } = auction;
    
    // If no bids, return NFT to seller
    if (option::is_none(&highest_bidder)) {
        transfer::public_transfer(nft, seller);
    } else {
        let winner = *option::borrow(&highest_bidder);
        
        // Transfer payment to seller
        let payment_balance = table::remove(&mut auction_house.held_bids, winner);
        let payment_coin = coin::from_balance(payment_balance, ctx);
        transfer::public_transfer(payment_coin, seller);
        
        // Transfer NFT to winner
        transfer::public_transfer(nft, winner);
    };
    
    auction_house.completed_auctions = auction_house.completed_auctions + 1;
}

// Cancel auction (only seller can do this before any bids)
public entry fun cancel_auction(
    auction_house: &mut AuctionHouse,
    auction_id: ID,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&auction_house.auctions, auction_id), E_AUCTION_NOT_FOUND);
    
    let auction = table::borrow(&auction_house.auctions, auction_id);
    let sender = tx_context::sender(ctx);
    assert!(sender == auction.seller, E_NOT_AUCTION_CREATOR);
    
    // Can only cancel if no bids placed
    assert!(option::is_none(&auction.highest_bidder), E_BID_TOO_LOW);
    
    let auction = table::remove(&mut auction_house.auctions, auction_id);
    let Auction {
        id: _,
        nft,
        seller,
        starting_price: _,
        current_bid: _,
        highest_bidder: _,
        end_time: _,
        created_at: _,
    } = auction;
    
    transfer::public_transfer(nft, seller);
}

// View functions
public fun get_auction_info(auction_house: &AuctionHouse, auction_id: ID): (u64, Option<address>, u64, address) {
    let auction = table::borrow(&auction_house.auctions, auction_id);
    (auction.current_bid, auction.highest_bidder, auction.end_time, auction.seller)
}

public fun is_auction_active(auction_house: &AuctionHouse, auction_id: ID, clock: &Clock): bool {
    if (!table::contains(&auction_house.auctions, auction_id)) {
        return false
    };
    
    let auction = table::borrow(&auction_house.auctions, auction_id);
    let current_time = clock::timestamp_ms(clock);
    current_time < auction.end_time
}

public fun get_auction_stats(auction_house: &AuctionHouse): AuctionStats {
    AuctionStats {
        total_auctions: auction_house.total_auctions,
        active_auctions: table::length(&auction_house.auctions),
        completed_auctions: auction_house.completed_auctions,
    }
}

public fun auction_exists(auction_house: &AuctionHouse, auction_id: ID): bool {
    table::contains(&auction_house.auctions, auction_id)
}