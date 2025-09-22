module 0x0::marketplace;

use nft_marketplace::nft_marketplace::{Self, SimpleNFT};
use std::string::String;
use sui::coin::{Self, Coin};
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::tx_context::{Self, TxContext};

const E_INSUFFICIENT_PAYMENT: u64 = 1;
const E_NOT_OWNER: u64 = 2;
const E_NFT_NOT_LISTED: u64 = 3;

public struct Listing has store {
    nft_id: ID,
    seller: address,
    price: u64,
    nft: SimpleNFT,
}

public struct Marketplace has key {
    id: UID,
    listings: Table<ID, Listing>,
}

fun init(ctx: &mut TxContext) {
    let marketplace = Marketplace {
        id: object::new(ctx),
        listings: table::new(ctx),
    };
    transfer::share_object(marketplace);
}

public entry fun list_nft(
    marketplace: &mut Marketplace,
    nft: SimpleNFT,
    price: u64,
    ctx: &mut TxContext,
) {
    let nft_id = object::id(&nft);
    let seller = tx_context::sender(ctx);
    // let name = *nft_marketplace::get_name(&nft);

    let listing = Listing {
        nft_id,
        seller,
        price,
        nft,
    };

    table::add(&mut marketplace.listings, nft_id, listing);
}

public entry fun unlist_nft(marketplace: &mut Marketplace, nft_id: ID, ctx: &mut TxContext) {
    assert!(table::contains(&marketplace.listings, nft_id), E_NFT_NOT_LISTED);

    let listing = table::remove(&mut marketplace.listings, nft_id);
    let Listing { nft_id: _, seller, price: _, nft } = listing;

    let sender = tx_context::sender(ctx);
    assert!(sender == seller, E_NOT_OWNER);

    transfer::public_transfer(nft, seller);
}

public entry fun buy_nft(
    marketplace: &mut Marketplace,
    nft_id: ID,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(table::contains(&marketplace.listings, nft_id), E_NFT_NOT_LISTED);

    let listing = table::remove(&mut marketplace.listings, nft_id);
    let Listing { nft_id: _, seller, price, nft } = listing;

    let payment_amount = coin::value(&payment);
    assert!(payment_amount >= price, E_INSUFFICIENT_PAYMENT);

    transfer::public_transfer(payment, seller);

    let buyer = tx_context::sender(ctx);
    transfer::public_transfer(nft, buyer);
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
