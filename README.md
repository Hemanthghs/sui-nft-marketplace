# Building an NFT Marketplace on Sui: A Practical Guide

**Learn how to create a fully functional NFT marketplace with listing, buying, and fee management on the Sui blockchain**

---

## Introduction

In this tutorial, we'll build a complete NFT marketplace on Sui using Move. Our marketplace will support:
- Minting NFTs with metadata
- Listing NFTs for sale
- Buying NFTs with automatic fee collection
- Price updates and unlisting
- Marketplace statistics tracking

Let's dive into the implementation!

---

## Prerequisites

- Sui CLI installed ([Installation Guide](https://docs.sui.io/guides/developer/getting-started/sui-install))
- Basic understanding of Move language
- Familiarity with blockchain concepts

---

## Setting Up Local Development Environment

### Start Local Testnet

First, let's spin up a local Sui network for testing:

```bash
RUST_LOG="off,sui_node=info" sui start --with-faucet --force-regenesis
```

This command:
- Starts a local Sui node
- Enables the faucet for getting test tokens
- Forces a fresh genesis (clean slate)

Keep this terminal running and open a new terminal for the next steps.

### Configure Your Environment

```bash
# Connect to local network
sui client new-env --alias local --rpc http://127.0.0.1:9000

# Switch to local network
sui client switch --env local

# Check your address
sui client active-address

# Get some test SUI from local faucet
curl --location --request POST 'http://127.0.0.1:9123/gas' \
  --header 'Content-Type: application/json' \
  --data-raw "{
    \"FixedAmountRequest\": {
      \"recipient\": \"$(sui client active-address)\"
    }
  }"

# Verify your balance
sui client gas
```

---

## Project Structure

Create your project directory:

```bash
mkdir sui-nft-marketplace
cd sui-nft-marketplace
sui move new nft_marketplace
cd nft_marketplace
```

We'll create two modules:
1. `sources/nft_marketplace.move` - NFT creation and management
2. `sources/marketplace.move` - Marketplace logic for trading

---

## Part 1: Creating the NFT Module

Create `sources/nft_marketplace.move`:

### NFT Structure

First, let's define our NFT structure with basic metadata:

```move
module nft_marketplace::nft_marketplace;

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
```

The `store` ability is crucial here - it allows NFTs to be stored in the marketplace's listings table.

### Minting NFTs

Here's how we mint a new NFT:

```move
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
```

### Creating NFTs (Entry Function)

For direct user interaction, we provide an entry function:

```move
public entry fun create_nft(
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    ctx: &mut TxContext,
) {
    let nft = mint_nft(name, description, image_url, ctx);
    transfer::public_transfer(nft, tx_context::sender(ctx));
}
```

### Getter Functions

Add helper functions to read NFT data:

```move
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
```

---

## Part 2: Building the Marketplace

Create `sources/marketplace.move`:

### Module Declaration and Imports

```move
module nft_marketplace::marketplace;

use nft_marketplace::nft_marketplace::{Self, SimpleNFT};
use std::string::String;
use sui::coin::{Self, Coin};
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::tx_context::{Self, TxContext};
use sui::balance::{Self, Balance};
```

### Constants and Error Codes

We define clear error codes for better debugging:

```move
const E_INSUFFICIENT_PAYMENT: u64 = 1;
const E_NOT_OWNER: u64 = 2;
const E_NFT_NOT_LISTED: u64 = 3;
const E_INVALID_PRICE: u64 = 4; 
const E_CANNOT_BUY_OWN_NFT: u64 = 5;

const MAX_FEE_PERCENT: u64 = 1000; // 10% max fee
const BASIS_POINTS: u64 = 10000; // 100% in basis points
```

### Core Data Structures

The marketplace uses two main structures:

```move
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
    fee_percent: u64, // basis points (100 = 1%)
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
```

### Initializing the Marketplace

The marketplace is created once and shared:

```move
fun init(ctx: &mut TxContext) {
    let marketplace = Marketplace {
        id: object::new(ctx),
        listings: table::new(ctx),
        admin: tx_context::sender(ctx),
        fee_percent: 250, // 2.5% default fee
        fee_balance: balance::zero(),
        total_volume: 0,
        total_sales: 0,
    };
    transfer::share_object(marketplace);
}
```

### Listing an NFT

Sellers can list their NFTs by transferring ownership to the marketplace:

```move
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

    let listing = Listing {
        nft_id,
        seller,
        price,
        nft,
        listed_at,
    };

    table::add(&mut marketplace.listings, nft_id, listing); 
}
```

### Buying an NFT

The buy function handles payment splitting and fee collection:

```move
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

    // Calculate fees
    let fee_amount = (price * marketplace.fee_percent) / BASIS_POINTS;
    let seller_amount = price - fee_amount;

    // Split payment
    let fee_coin = coin::split(&mut payment, fee_amount, ctx);
    let seller_coin = coin::split(&mut payment, seller_amount, ctx);

    // Return excess payment
    if (coin::value(&payment) > 0) {
        transfer::public_transfer(payment, buyer);
    } else {
        coin::destroy_zero(payment);
    };

    // Collect fees
    balance::join(&mut marketplace.fee_balance, coin::into_balance(fee_coin));

    // Transfer payments and NFT
    transfer::public_transfer(seller_coin, seller);
    transfer::public_transfer(nft, buyer);

    // Update stats
    marketplace.total_volume = marketplace.total_volume + price;
    marketplace.total_sales = marketplace.total_sales + 1;
}
```

### Unlisting an NFT

Sellers can remove their listings and reclaim their NFTs:

```move
public entry fun unlist_nft(
    marketplace: &mut Marketplace, 
    nft_id: ID, 
    ctx: &mut TxContext
) {
    assert!(table::contains(&marketplace.listings, nft_id), E_NFT_NOT_LISTED);

    let listing = table::remove(&mut marketplace.listings, nft_id);
    let Listing { nft_id: _, seller, price: _, nft, listed_at: _ } = listing;

    let sender = tx_context::sender(ctx);
    assert!(sender == seller, E_NOT_OWNER);

    transfer::public_transfer(nft, seller);
}
```

### Updating Listing Price

Sellers can adjust prices without unlisting:

```move
public entry fun update_price(
    marketplace: &mut Marketplace, 
    nft_id: ID, 
    new_price: u64, 
    ctx: &mut TxContext
) {
    assert!(new_price > 0, E_INVALID_PRICE);
    assert!(table::contains(&marketplace.listings, nft_id), E_NFT_NOT_LISTED);

    let listing = table::borrow_mut(&mut marketplace.listings, nft_id);
    let sender = tx_context::sender(ctx);
    assert!(sender == listing.seller, E_NOT_OWNER);

    listing.price = new_price;
}
```

### Query Functions

Add functions to query marketplace data:

```move
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
```

---

## Testing Your Marketplace

### Step 1: Build and Deploy

```bash
# Build the package
sui move build

# Publish to local network
sui client publish --gas-budget 100000000
```

**Important**: Save the `PACKAGE_ID` and `MARKETPLACE_ID` from the output!

```bash
# Export for easy use
export PACKAGE_ID=0x...
export MARKETPLACE_ID=0x...
```

### Step 2: Create Test NFTs

```bash
# Create first NFT
sui client call \
  --package $PACKAGE_ID \
  --module nft_marketplace \
  --function create_nft \
  --args "Cosmic Dragon" "Legendary digital art" "https://picsum.photos/800/600?random=1" \
  --gas-budget 10000000

# Create second NFT
sui client call \
  --package $PACKAGE_ID \
  --module nft_marketplace \
  --function create_nft \
  --args "Cyber Punk City" "Futuristic cityscape" "https://picsum.photos/800/600?random=2" \
  --gas-budget 10000000
```

### Step 3: Get Your NFT IDs

```bash
# List all your objects
sui client objects

# Look for objects of type: PACKAGE_ID::nft_marketplace::SimpleNFT
# Export the IDs
export NFT_ID_1=0x...
export NFT_ID_2=0x...
```

### Step 4: List NFTs for Sale

```bash
# List first NFT for 2 SUI (2000000000 MIST)
# Note: 1 SUI = 1,000,000,000 MIST
sui client call \
  --package $PACKAGE_ID \
  --module marketplace \
  --function list_nft \
  --args $MARKETPLACE_ID $NFT_ID_1 2000000000 \
  --gas-budget 10000000

# List second NFT for 1.5 SUI (1500000000 MIST)
sui client call \
  --package $PACKAGE_ID \
  --module marketplace \
  --function list_nft \
  --args $MARKETPLACE_ID $NFT_ID_2 1500000000 \
  --gas-budget 10000000
```

### Step 5: Update a Listing Price

```bash
# Change price of first NFT to 1.8 SUI
sui client call \
  --package $PACKAGE_ID \
  --module marketplace \
  --function update_price \
  --args $MARKETPLACE_ID $NFT_ID_1 1800000000 \
  --gas-budget 10000000
```

### Step 6: Buy an NFT

```bash
# Get a coin object with enough SUI
sui client gas

# Export a coin ID with sufficient balance
export COIN_ID=0x...

# Buy the second NFT
sui client call \
  --package $PACKAGE_ID \
  --module marketplace \
  --function buy_nft \
  --args $MARKETPLACE_ID $NFT_ID_2 $COIN_ID \
  --gas-budget 10000000
```

### Step 7: Check Marketplace Statistics

```bash
# View the marketplace object to see stats
sui client object $MARKETPLACE_ID --json
```

### Step 8: Unlist an NFT

```bash
# Remove your listing (you must be the seller)
sui client call \
  --package $PACKAGE_ID \
  --module marketplace \
  --function unlist_nft \
  --args $MARKETPLACE_ID $NFT_ID_1 \
  --gas-budget 10000000
```

### Useful Commands for Debugging

```bash
# View specific NFT details
sui client object $NFT_ID

# View transaction details
sui client tx-block $TX_DIGEST

# View all events from your package
sui client events --package $PACKAGE_ID

# Check your active address
sui client active-address

# List all addresses in your wallet
sui client addresses

# Switch between addresses
sui client switch --address $ADDRESS
```

## Key Features Explained

### 🎯 Fee Mechanism
The marketplace collects a 2.5% fee (250 basis points) on each sale. This is automatically deducted from the seller's payment and stored in the marketplace's `fee_balance`.

**Example**: 
- NFT price: 2 SUI
- Marketplace fee (2.5%): 0.05 SUI
- Seller receives: 1.95 SUI

### 🔒 Safety Checks
- ✅ Buyers cannot purchase their own NFTs
- ✅ Only sellers can unlist or update prices
- ✅ All prices must be greater than zero
- ✅ Payment must meet or exceed the listing price
- ✅ Excess payment is automatically refunded

### 🌐 Shared Object Pattern
The marketplace is a shared object, allowing concurrent access from multiple users without ownership constraints. This is perfect for a marketplace where many users need to interact simultaneously.

### 💰 Payment Handling
The contract uses Sui's native `Coin` and `Balance` types to handle payments safely:
- Splits payment into fee and seller portions
- Handles change/refunds automatically
- Stores fees in the marketplace balance

---

## Common Issues and Solutions

### Issue: "Object not found"
**Solution**: Make sure you're using the correct PACKAGE_ID and object IDs from your deployment.

### Issue: "Insufficient gas"
**Solution**: Increase the gas budget or get more SUI from the faucet.

### Issue: "Cannot transfer object"
**Solution**: Verify you own the NFT and haven't already listed it.

### Issue: "Type mismatch"
**Solution**: Ensure you're using the correct module names (they must match your package ID).

---

## Resources

- **Sui Documentation**: https://docs.sui.io
- **Move Book**: https://move-book.com
- **Sui Examples**: https://github.com/MystenLabs/sui/tree/main/examples
- **Sui Discord**: https://discord.gg/sui

---

## Complete Source Code

The full source code is available on GitHub: [https://github.com/Hemanthghs/sui-nft-marketplace](https://github.com/Hemanthghs/sui-nft-marketplace)

---

**Happy Building on Sui! 🚀**

If you found this tutorial helpful, please give it a star and follow for more Sui development content!

---
