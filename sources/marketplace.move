module 0x0::marketplace;

use nft_marketplace::nft_marketplace::{Self, SimpleNFT};
use std::string::String;
use sui::coin::{Self, Coin};
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::tx_context::{Self, TxContext};
use sui::balance::{Self, Balance};

const E_INSUFFICIENT_PAYMENT: u64 = 1;
const E_NOT_OWNER: u64 = 2;
const E_NFT_NOT_LISTED: u64 = 3;
const E_INVALID_PRICE: u64 = 4; 
const E_CANNOT_BUY_OWN_NFT: u64 = 5;

const MAX_FEE_PERCENT: u64 = 1000; // 10% max fee (basis points)
const BASIS_POINTS: u64 = 10000; // 100% in basis points



public struct Listing has store {
    nft_id: ID,
    seller: address,
    price: u64,
    nft: SimpleNFT,
    listed_at: u64,
}

public struct Marketplace has key {
    id: UID,
    listings: Table<ID, Listing>,
    admin: address,
    fee_percent: u64, // (100 = 1%)
    fee_balance: Balance<SUI>,
    total_volume: u64,
    total_sales: u64,
}

public struct MarketplaceStats has copy, drop {
    total_listings: u64,
    total_volume: u64,
    total_sales: u64,
    collected_fees: u64,
}

fun init(ctx: &mut TxContext) {
    let marketplace = Marketplace {
        id: object::new(ctx),
        listings: table::new(ctx),
        admin: tx_context::sender(ctx),
        fee_percent: 250, // 2.5%
        fee_balance: balance::zero(),
        total_volume: 0,
        total_sales: 0,
    };
    transfer::share_object(marketplace);
}

public entry fun list_nft(
    marketplace: &mut Marketplace,
    nft: SimpleNFT,
    price: u64,
    ctx: &mut TxContext,
) {

    assert!(price > 0, E_INVALID_PRICE);
    let nft_id = object::id(&nft);
    let seller = tx_context::sender(ctx);
    let listed_at = tx_context::epoch(ctx);
    // let name = *nft_marketplace::get_name(&nft);

    let listing = Listing {
        nft_id,
        seller,
        price,
        nft,
        listed_at,
    };

    table::add(&mut marketplace.listings, nft_id, listing);
}

public entry fun unlist_nft(marketplace: &mut Marketplace, nft_id: ID, ctx: &mut TxContext) {
    assert!(table::contains(&marketplace.listings, nft_id), E_NFT_NOT_LISTED);

    let listing = table::remove(&mut marketplace.listings, nft_id);
    let Listing { nft_id: _, seller, price: _, nft, listed_at: _ } = listing;

    let sender = tx_context::sender(ctx);
    assert!(sender == seller, E_NOT_OWNER);

    transfer::public_transfer(nft, seller);
}

public entry fun buy_nft(
    marketplace: &mut Marketplace,
    nft_id: ID,
    mut payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&marketplace.listings, nft_id), E_NFT_NOT_LISTED);

    let listing = table::remove(&mut marketplace.listings, nft_id);
    let Listing { nft_id: _, seller, price, nft, listed_at: _ } = listing;

    let buyer = tx_context::sender(ctx);
    assert!(buyer != seller, E_CANNOT_BUY_OWN_NFT);

    let payment_amount = coin::value(&payment);
    assert!(payment_amount >= price, E_INSUFFICIENT_PAYMENT);

    let fee_amount = (price * marketplace.fee_percent) / BASIS_POINTS;
    let seller_amount = price - fee_amount;

    let fee_coin = coin::split(&mut payment, fee_amount, ctx);
    let seller_coin = coin::split(&mut payment, seller_amount, ctx);

    if (coin::value(&payment) > 0) {
        transfer::public_transfer(payment, buyer);
    } else {
        coin::destroy_zero(payment);
    };

    balance::join(&mut marketplace.fee_balance, coin::into_balance(fee_coin));

    transfer::public_transfer(seller_coin, seller);

    transfer::public_transfer(nft, buyer);

    marketplace.total_volume = marketplace.total_volume + price;
    marketplace.total_sales = marketplace.total_sales + 1;
}

public entry fun update_price(marketplace: &mut Marketplace, nft_id: ID, new_price: u64, ctx: &mut TxContext) {
    assert!(new_price > 0, E_INVALID_PRICE);
    assert!(table::contains(&marketplace.listings, nft_id), E_NFT_NOT_LISTED);

    let listing = table::borrow_mut(&mut marketplace.listings, nft_id);
    let sender = tx_context::sender(ctx);
    assert!(sender == listing.seller, E_NOT_OWNER);

    let old_price = listing.price;
    listing.price = new_price;
}

public fun get_marketplace_stats(marketplace: &Marketplace): MarketplaceStats {
    MarketplaceStats {
        total_listings: table::length(&marketplace.listings),
        total_volume: marketplace.total_volume,
        total_sales: marketplace.total_sales,
        collected_fees: balance::value(&marketplace.fee_balance),
    }
}

public fun get_listing_price(marketplace: &Marketplace, nft_id: ID): u64 {
    let listing = table::borrow(&marketplace.listings, nft_id);
    listing.price
}

public fun get_listing_seller(marketplace: &Marketplace, nft_id: ID): address {
    let listing = table::borrow(&marketplace.listings, nft_id);
    listing.seller
}

public fun is_listed(marketplace: &Marketplace, nft_id: ID): bool {
    table::contains(&marketplace.listings, nft_id)
}
