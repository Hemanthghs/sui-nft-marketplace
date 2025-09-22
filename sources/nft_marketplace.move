/*
/// Module: nft_marketplace
module nft_marketplace::nft_marketplace;
*/

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions

module 0x0::nft_marketplace;

use std::string::{Self, String};
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

public struct SimpleNFT has key, store {
    id: UID,
    name: String,
    description: String,
    image_url: String,
    creator: address,
}

public fun mint_nft(
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    ctx: &mut TxContext,
): SimpleNFT {
    SimpleNFT {
        id: object::new(ctx),
        name: string::utf8(name),
        description: string::utf8(description),
        image_url: string::utf8(image_url),
        creator: tx_context::sender(ctx),
    }
}

public entry fun create_nft(
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    ctx: &mut TxContext,
) {
    let nft = mint_nft(name, description, image_url, ctx);
    transfer::public_transfer(nft, tx_context::sender(ctx));
}

public fun get_name(nft: &SimpleNFT): &String {
    &nft.name
}

public fun get_description(nft: &SimpleNFT): &String {
    &nft.description
}

public fun get_image_url(nft: &SimpleNFT): &String {
    &nft.image_url
}

public fun get_creator(nft: &SimpleNFT): address {
    nft.creator
}
