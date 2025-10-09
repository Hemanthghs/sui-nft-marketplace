import { useState, useEffect } from "react";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading, Card, TextField, TextArea, Button, Text, Tabs, Grid, Badge } from "@radix-ui/themes";
import { Transaction } from "@mysten/sui/transactions";


// Replace with your actual deployed package IDs
const NFT_PACKAGE_ID =
  "0x9dc9a29c84fdd5278de566d6289951e1511b5048d4ec1e7f5189fcafc5338b6b";
const MARKETPLACE_PACKAGE_ID =
  "0x9dc9a29c84fdd5278de566d6289951e1511b5048d4ec1e7f5189fcafc5338b6b"; // Replace with your marketplace package ID
const MARKETPLACE_OBJECT_ID =
  "0xac52ae47ab7fa4672b4ad6d697293239ee8285df909080c1d84360acf3237f16"; // Replace with your shared Marketplace object ID

const AUCTION_PACKAGE_ID = "0x9dc9a29c84fdd5278de566d6289951e1511b5048d4ec1e7f5189fcafc5338b6b"; // Replace with your auction package ID
const AUCTION_HOUSE_OBJECT_ID = "0xab1d95a4f97537a0c24fe127e8d43292c15699c7799529d67bc8cdc692a5ed49"; // Replace with your shared AuctionHouse object ID
const CLOCK_OBJECT_ID = "0x6"; // Sui Clock object (standard address)

interface StatusMessage {
  type: "success" | "error" | null;
  message: string;
}

interface NFTData {
  id: string;
  name: string;
  description: string;
  image_url: string;
  creator?: string;
  price?: number;
  seller?: string;
}

interface MarketplaceStats {
  total_listings: string;
  total_volume: string;
  total_sales: string;
  collected_fees: string;
}

interface AuctionData {
  id: string;
  nft: NFTData;
  seller: string;
  starting_price: number;
  current_bid: number;
  highest_bidder: string | null;
  end_time: number;
  created_at: number;
}

interface AuctionStats {
  total_auctions: string;
  active_auctions: string;
  completed_auctions: string;
}

function App() {
  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Box>
          <Heading>NFT Marketplace</Heading>
        </Box>
        <Box>
          <ConnectButton />
        </Box>
      </Flex>
      <Container>
        <Container
          mt="5"
          pt="2"
          px="4"
          style={{ background: "var(--gray-a2)", minHeight: 500 }}
        >
          <MarketplaceTabs />
        </Container>
      </Container>
    </>
  );
}

function MarketplaceTabs() {
  const account = useCurrentAccount();

  if (!account) {
    return (
      <Card>
        <Flex direction="column" gap="3" align="center" py="5">
          <Text size="3" color="gray">
            Please connect your wallet to use the marketplace
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Tabs.Root defaultValue="create">
      <Tabs.List>
        <Tabs.Trigger value="create">Create NFT</Tabs.Trigger>
        <Tabs.Trigger value="my-nfts">My NFTs</Tabs.Trigger>
        <Tabs.Trigger value="marketplace">Marketplace</Tabs.Trigger>
        <Tabs.Trigger value="auctions">Auctions</Tabs.Trigger>
      </Tabs.List>

      <Box pt="4">
        <Tabs.Content value="create">
          <CreateNFT />
        </Tabs.Content>

        <Tabs.Content value="my-nfts">
          <MyNFTs />
        </Tabs.Content>

        <Tabs.Content value="marketplace">
          <MarketplaceListings />
        </Tabs.Content>

        <Tabs.Content value="auctions">
          <AuctionsTab />
        </Tabs.Content>
      </Box>
    </Tabs.Root>
  );
}

function CreateNFT() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusMessage>({ type: null, message: "" });
  const [stats, setStats] = useState<MarketplaceStats | null>(null);

  const { data: balanceData } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address as string },
    { enabled: !!account }
  );

  const balance = balanceData ? Number(balanceData.totalBalance) / 1e9 : 0;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${MARKETPLACE_PACKAGE_ID}::marketplace::get_marketplace_stats`,
          arguments: [tx.object(MARKETPLACE_OBJECT_ID)],
        });

        const result = await suiClient.devInspectTransactionBlock({
          transactionBlock: tx,
          sender: account?.address as string,
        });

        if (result.results && result.results[0]) {
          const returnValues = result.results[0].returnValues;
          if (returnValues && returnValues[0]) {
            const [bytes] = returnValues[0];
            const view = new DataView(new Uint8Array(bytes).buffer);
            const total_listings = view.getBigUint64(0, true).toString();
            const total_volume = view.getBigUint64(8, true).toString();
            const total_sales = view.getBigUint64(16, true).toString();
            const collected_fees = view.getBigUint64(24, true).toString();

            setStats({
              total_listings,
              total_volume,
              total_sales,
              collected_fees,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching marketplace stats:", error);
      }
    };

    if (account) {
      fetchStats();
    }
  }, [account, suiClient]);

  const handleCreateNFT = () => {
    if (balance < 0.01) {
      setStatus({ type: "error", message: "Insufficient SUI balance" });
      return;
    }

    if (!name.trim() || !description.trim() || !imageUrl.trim()) {
      setStatus({ type: "error", message: "Please fill in all fields" });
      return;
    }

    setStatus({ type: null, message: "" });
    setIsCreating(true);

    const tx = new Transaction();
    tx.moveCall({
      target: `${NFT_PACKAGE_ID}::nft_marketplace::create_nft`,
      arguments: [
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.string(imageUrl),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: `NFT created! ${result.digest.slice(0, 10)}...` });
            setName("");
            setDescription("");
            setImageUrl("");
            setIsCreating(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsCreating(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsCreating(false);
        },
      }
    );
  };

  return (
    <Card style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Flex direction="column" gap="4">
        <Heading size="5">Create New NFT</Heading>

        {stats && (
          <Card style={{ backgroundColor: "var(--blue-3)" }}>
            <Flex direction="column" gap="2">
              <Heading size="3">Marketplace Statistics</Heading>
              <Grid columns="2" gap="3">
                <Flex direction="column">
                  <Text size="1" color="gray">Total Listings</Text>
                  <Text size="3" weight="bold">{stats.total_listings}</Text>
                </Flex>
                <Flex direction="column">
                  <Text size="1" color="gray">Total Sales</Text>
                  <Text size="3" weight="bold">{stats.total_sales}</Text>
                </Flex>
                <Flex direction="column">
                  <Text size="1" color="gray">Total Volume</Text>
                  <Text size="3" weight="bold">
                    {(Number(stats.total_volume) / 1e9).toFixed(2)} SUI
                  </Text>
                </Flex>
                <Flex direction="column">
                  <Text size="1" color="gray">Collected Fees</Text>
                  <Text size="3" weight="bold">
                    {(Number(stats.collected_fees) / 1e9).toFixed(4)} SUI
                  </Text>
                </Flex>
              </Grid>
            </Flex>
          </Card>
        )}

        <Flex justify="between" align="center">
          <Text size="2" color="gray">Balance:</Text>
          <Text size="3" weight="bold">{balance.toFixed(4)} SUI</Text>
        </Flex>

        <TextField.Root 
          placeholder="NFT Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          disabled={isCreating} 
        />
        
        <TextArea 
          placeholder="Description" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          disabled={isCreating} 
          rows={3} 
        />
        
        <TextField.Root 
          placeholder="Image URL" 
          value={imageUrl} 
          onChange={(e) => setImageUrl(e.target.value)} 
          disabled={isCreating} 
        />

        {imageUrl && (
          <img 
            src={imageUrl} 
            alt="Preview" 
            style={{ 
              width: "100%", 
              maxHeight: "300px", 
              objectFit: "contain", 
              borderRadius: "8px" 
            }} 
            onError={(e) => { 
              (e.target as HTMLImageElement).style.display = "none"; 
            }} 
          />
        )}

        {status.type && (
          <Card style={{ backgroundColor: status.type === "success" ? "var(--green-3)" : "var(--red-3)" }}>
            <Text size="2" color={status.type === "success" ? "green" : "red"}>
              {status.message}
            </Text>
          </Card>
        )}

        <Button 
          size="3" 
          onClick={handleCreateNFT} 
          disabled={isCreating || !name || !description || !imageUrl}
        >
          {isCreating ? "Creating..." : "Create NFT"}
        </Button>
      </Flex>
    </Card>
  );
}

function MyNFTs() {
  const account = useCurrentAccount();
  const [nfts, setNfts] = useState<NFTData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const { data: ownedObjects } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address as string,
      filter: { StructType: `${NFT_PACKAGE_ID}::nft_marketplace::SimpleNFT` },
      options: { showContent: true, showType: true },
    },
    { enabled: !!account }
  );

  useEffect(() => {
    if (ownedObjects) {
      const nftList: NFTData[] = ownedObjects.data.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        return {
          id: obj.data.objectId,
          name: fields?.name || "Unknown",
          description: fields?.description || "",
          image_url: fields?.image_url || "",
          creator: fields?.creator || "",
        };
      });
      setNfts(nftList);
      setLoading(false);
    }
  }, [ownedObjects]);

  if (loading) {
    return <Text>Loading your NFTs...</Text>;
  }

  if (nfts.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="center" py="5">
          <Text size="3" color="gray">You don't own any NFTs yet</Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Grid columns="3" gap="4">
      {nfts.map((nft) => (
        <NFTCard key={nft.id} nft={nft} isOwned={true} />
      ))}
    </Grid>
  );
}

interface NFTCardProps {
  nft: NFTData;
  isOwned: boolean;
}

function NFTCard({ nft, isOwned }: NFTCardProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  
  const [listPrice, setListPrice] = useState<string>("");
  const [showListForm, setShowListForm] = useState<boolean>(false);
  const [showAuctionForm, setShowAuctionForm] = useState<boolean>(false);
  const [auctionStartPrice, setAuctionStartPrice] = useState<string>("");
  const [auctionDuration, setAuctionDuration] = useState<string>("24");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusMessage>({ type: null, message: "" });

  const handleListNFT = () => {
    const price = parseFloat(listPrice);
    if (!price || price <= 0) {
      setStatus({ type: "error", message: "Invalid price" });
      return;
    }

    setIsProcessing(true);
    const priceInMist = Math.floor(price * 1e9);

    const tx = new Transaction();
    tx.moveCall({
      target: `${MARKETPLACE_PACKAGE_ID}::marketplace::list_nft`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.object(nft.id),
        tx.pure.u64(priceInMist),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: "NFT listed!" });
            setShowListForm(false);
            setIsProcessing(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsProcessing(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsProcessing(false);
        },
      }
    );
  };

  const handleCreateAuction = () => {
    const price = parseFloat(auctionStartPrice);
    const duration = parseFloat(auctionDuration);
    
    if (!price || price <= 0) {
      setStatus({ type: "error", message: "Invalid starting price" });
      return;
    }
    
    if (!duration || duration < 1 || duration > 168) {
      setStatus({ type: "error", message: "Duration must be between 1-168 hours" });
      return;
    }

    setIsProcessing(true);
    const priceInMist = Math.floor(price * 1e9);
    const durationInMs = Math.floor(duration * 3600000);

    const tx = new Transaction();
    tx.moveCall({
      target: `${AUCTION_PACKAGE_ID}::auction::create_auction`,
      arguments: [
        tx.object(AUCTION_HOUSE_OBJECT_ID),
        tx.object(nft.id),
        tx.pure.u64(priceInMist),
        tx.pure.u64(durationInMs),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: "Auction created!" });
            setShowAuctionForm(false);
            setIsProcessing(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsProcessing(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsProcessing(false);
        },
      }
    );
  };

  const handleUnlistNFT = () => {
    setIsProcessing(true);

    const tx = new Transaction();
    tx.moveCall({
      target: `${MARKETPLACE_PACKAGE_ID}::marketplace::unlist_nft`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.pure.id(nft.id),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: "NFT unlisted!" });
            setIsProcessing(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsProcessing(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsProcessing(false);
        },
      }
    );
  };

  const handleBuyNFT = () => {
    if (!nft.price) return;

    setIsProcessing(true);
    const tx = new Transaction();
    
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(nft.price)]);
    
    tx.moveCall({
      target: `${MARKETPLACE_PACKAGE_ID}::marketplace::buy_nft`,
      arguments: [
        tx.object(MARKETPLACE_OBJECT_ID),
        tx.pure.id(nft.id),
        coin,
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: "NFT purchased!" });
            setIsProcessing(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsProcessing(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsProcessing(false);
        },
      }
    );
  };

  return (
    <Card>
      <Flex direction="column" gap="3">
        <img 
          src={nft.image_url} 
          alt={nft.name} 
          style={{ 
            width: "100%", 
            height: "200px", 
            objectFit: "cover", 
            borderRadius: "8px" 
          }} 
        />
        
        <Heading size="4">{nft.name}</Heading>
        <Text size="2" color="gray">{nft.description}</Text>
        
        {nft.price && (
          <Flex align="center" gap="2">
            <Badge color="blue">{(nft.price / 1e9).toFixed(2)} SUI</Badge>
          </Flex>
        )}

        {status.type && (
          <Text size="1" color={status.type === "success" ? "green" : "red"}>
            {status.message}
          </Text>
        )}

        {isOwned && !showListForm && !showAuctionForm && (
          <Flex gap="2">
            <Button size="2" onClick={() => setShowListForm(true)} disabled={isProcessing}>
              List for Sale
            </Button>
            <Button size="2" variant="soft" onClick={() => setShowAuctionForm(true)} disabled={isProcessing}>
              Create Auction
            </Button>
          </Flex>
        )}

        {isOwned && showListForm && (
          <Flex direction="column" gap="2">
            <TextField.Root 
              placeholder="Price in SUI" 
              value={listPrice} 
              onChange={(e) => setListPrice(e.target.value)} 
            />
            <Flex gap="2">
              <Button size="2" onClick={handleListNFT} disabled={isProcessing}>
                List
              </Button>
              <Button size="2" variant="soft" onClick={() => setShowListForm(false)}>
                Cancel
              </Button>
            </Flex>
          </Flex>
        )}

        {isOwned && showAuctionForm && (
          <Flex direction="column" gap="2">
            <TextField.Root 
              placeholder="Starting Price in SUI" 
              value={auctionStartPrice} 
              onChange={(e) => setAuctionStartPrice(e.target.value)} 
            />
            <TextField.Root 
              placeholder="Duration (hours, 1-168)" 
              value={auctionDuration} 
              onChange={(e) => setAuctionDuration(e.target.value)} 
            />
            <Flex gap="2">
              <Button size="2" onClick={handleCreateAuction} disabled={isProcessing}>
                Create
              </Button>
              <Button size="2" variant="soft" onClick={() => setShowAuctionForm(false)}>
                Cancel
              </Button>
            </Flex>
          </Flex>
        )}

        {!isOwned && nft.seller === account?.address && (
          <Button size="2" variant="soft" color="orange" onClick={handleUnlistNFT} disabled={isProcessing}>
            {isProcessing ? "Unlisting..." : "Unlist NFT"}
          </Button>
        )}

        {!isOwned && nft.seller !== account?.address && (
          <Button size="2" onClick={handleBuyNFT} disabled={isProcessing}>
            {isProcessing ? "Buying..." : "Buy NFT"}
          </Button>
        )}
      </Flex>
    </Card>
  );
}

function MarketplaceListings() {
  const suiClient = useSuiClient();
  const [listings, setListings] = useState<NFTData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const marketplaceObj = await suiClient.getObject({
          id: MARKETPLACE_OBJECT_ID,
          options: { showContent: true },
        });

        const fields = marketplaceObj.data?.content as any;
        const listingsTable = fields?.fields?.listings?.fields?.id?.id;

        if (listingsTable) {
          const dynamicFields = await suiClient.getDynamicFields({
            parentId: listingsTable,
          });

          const listingPromises = dynamicFields.data.map(async (field: any) => {
            const listingObj = await suiClient.getObject({
              id: field.objectId,
              options: { showContent: true },
            });
            
            const listingFields = (listingObj.data?.content as any)?.fields?.value?.fields;
            const nftFields = listingFields?.nft?.fields;

            return {
              id: listingFields?.nft_id,
              name: nftFields?.name || "Unknown",
              description: nftFields?.description || "",
              image_url: nftFields?.image_url || "",
              price: listingFields?.price,
              seller: listingFields?.seller,
            };
          });

          const resolvedListings = await Promise.all(listingPromises);
          setListings(resolvedListings);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching listings:", error);
        setLoading(false);
      }
    };

    fetchListings();
  }, [suiClient]);

  if (loading) {
    return <Text>Loading marketplace...</Text>;
  }

  if (listings.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="center" py="5">
          <Text size="3" color="gray">No NFTs listed for sale</Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Grid columns="3" gap="4">
      {listings.map((nft) => (
        <NFTCard key={nft.id} nft={nft} isOwned={false} />
      ))}
    </Grid>
  );
}

function AuctionsTab() {
  return (
    <Flex direction="column" gap="4">
      <AuctionStatsCard />
      <ActiveAuctions />
    </Flex>
  );
}

function AuctionStatsCard() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [stats, setStats] = useState<AuctionStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${AUCTION_PACKAGE_ID}::auction::get_auction_stats`,
          arguments: [tx.object(AUCTION_HOUSE_OBJECT_ID)],
        });

        const result = await suiClient.devInspectTransactionBlock({
          transactionBlock: tx,
          sender: account?.address as string,
        });

        if (result.results && result.results[0]) {
          const returnValues = result.results[0].returnValues;
          if (returnValues && returnValues[0]) {
            const [bytes] = returnValues[0];
            const view = new DataView(new Uint8Array(bytes).buffer);
            const total_auctions = view.getBigUint64(0, true).toString();
            const active_auctions = view.getBigUint64(8, true).toString();
            const completed_auctions = view.getBigUint64(16, true).toString();

            setStats({
              total_auctions,
              active_auctions,
              completed_auctions,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching auction stats:", error);
      }
    };

    if (account) {
      fetchStats();
    }
  }, [account, suiClient]);

  if (!stats) {
    return <Text>Loading auction statistics...</Text>;
  }

  return (
    <Card style={{ backgroundColor: "var(--purple-3)" }}>
      <Flex direction="column" gap="2">
        <Heading size="3">Auction Statistics</Heading>
        <Grid columns="3" gap="3">
          <Flex direction="column">
            <Text size="1" color="gray">Total Auctions</Text>
            <Text size="3" weight="bold">{stats.total_auctions}</Text>
          </Flex>
          <Flex direction="column">
            <Text size="1" color="gray">Active Auctions</Text>
            <Text size="3" weight="bold">{stats.active_auctions}</Text>
          </Flex>
          <Flex direction="column">
            <Text size="1" color="gray">Completed</Text>
            <Text size="3" weight="bold">{stats.completed_auctions}</Text>
          </Flex>
        </Grid>
      </Flex>
    </Card>
  );
}

function ActiveAuctions() {
  const suiClient = useSuiClient();
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const auctionHouseObj = await suiClient.getObject({
          id: AUCTION_HOUSE_OBJECT_ID,
          options: { showContent: true },
        });

        const fields = auctionHouseObj.data?.content as any;
        const auctionsTable = fields?.fields?.auctions?.fields?.id?.id;

        if (auctionsTable) {
          const dynamicFields = await suiClient.getDynamicFields({
            parentId: auctionsTable,
          });

          const auctionPromises = dynamicFields.data.map(async (field: any) => {
            const auctionObj = await suiClient.getObject({
              id: field.objectId,
              options: { showContent: true },
            });
            
            const auctionFields = (auctionObj.data?.content as any)?.fields?.value?.fields;
            const nftFields = auctionFields?.nft?.fields;

            return {
              id: auctionFields?.id,
              nft: {
                id: auctionFields?.id,
                name: nftFields?.name || "Unknown",
                description: nftFields?.description || "",
                image_url: nftFields?.image_url || "",
                creator: nftFields?.creator,
              },
              seller: auctionFields?.seller,
              starting_price: parseInt(auctionFields?.starting_price),
              current_bid: parseInt(auctionFields?.current_bid),
              highest_bidder: auctionFields?.highest_bidder?.vec?.[0] || null,
              end_time: parseInt(auctionFields?.end_time),
              created_at: parseInt(auctionFields?.created_at),
            };
          });

          const resolvedAuctions = await Promise.all(auctionPromises);
          setAuctions(resolvedAuctions);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching auctions:", error);
        setLoading(false);
      }
    };

    fetchAuctions();
  }, [suiClient]);

  if (loading) {
    return <Text>Loading auctions...</Text>;
  }

  if (auctions.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="center" py="5">
          <Text size="3" color="gray">No active auctions</Text>
        </Flex>
      </Card>
    );
  }

  return (
    <>
      <Heading size="4">Active Auctions</Heading>
      <Grid columns="3" gap="4">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
      </Grid>
    </>
  );
}

interface AuctionCardProps {
  auction: AuctionData;
}

function AuctionCard({ auction }: AuctionCardProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  
  const [bidAmount, setBidAmount] = useState<string>("");
  const [showBidForm, setShowBidForm] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusMessage>({ type: null, message: "" });
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = auction.end_time - now;

      if (remaining <= 0) {
        setTimeRemaining("Ended");
        return;
      }

      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [auction.end_time]);

  const handlePlaceBid = () => {
    const bid = parseFloat(bidAmount);
    const minBid = auction.current_bid / 1e9;

    if (!bid || bid <= minBid) {
      setStatus({ type: "error", message: `Bid must be higher than ${minBid.toFixed(2)} SUI` });
      return;
    }

    setIsProcessing(true);
    const bidInMist = Math.floor(bid * 1e9);

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(bidInMist)]);
    
    tx.moveCall({
      target: `${AUCTION_PACKAGE_ID}::auction::place_bid`,
      arguments: [
        tx.object(AUCTION_HOUSE_OBJECT_ID),
        tx.pure.id(auction.id),
        coin,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: "Bid placed!" });
            setShowBidForm(false);
            setBidAmount("");
            setIsProcessing(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsProcessing(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsProcessing(false);
        },
      }
    );
  };

  const handleFinalizeAuction = () => {
    setIsProcessing(true);

    const tx = new Transaction();
    tx.moveCall({
      target: `${AUCTION_PACKAGE_ID}::auction::finalize_auction`,
      arguments: [
        tx.object(AUCTION_HOUSE_OBJECT_ID),
        tx.pure.id(auction.id),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: "Auction finalized!" });
            setIsProcessing(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsProcessing(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsProcessing(false);
        },
      }
    );
  };

  const handleCancelAuction = () => {
    setIsProcessing(true);

    const tx = new Transaction();
    tx.moveCall({
      target: `${AUCTION_PACKAGE_ID}::auction::cancel_auction`,
      arguments: [
        tx.object(AUCTION_HOUSE_OBJECT_ID),
        tx.pure.id(auction.id),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          suiClient.waitForTransaction({ digest: result.digest }).then(() => {
            setStatus({ type: "success", message: "Auction cancelled!" });
            setIsProcessing(false);
          }).catch((error) => {
            console.error("Error waiting for transaction:", error);
            setStatus({ type: "error", message: "Transaction submitted but confirmation failed" });
            setIsProcessing(false);
          });
        },
        onError: (error) => {
          setStatus({ type: "error", message: error.message });
          setIsProcessing(false);
        },
      }
    );
  };

  const isAuctionEnded = Date.now() >= auction.end_time;
  const isSeller = auction.seller === account?.address;
  const isHighestBidder = auction.highest_bidder === account?.address;

  return (
    <Card>
      <Flex direction="column" gap="3">
        <img 
          src={auction.nft.image_url} 
          alt={auction.nft.name} 
          style={{ 
            width: "100%", 
            height: "200px", 
            objectFit: "cover", 
            borderRadius: "8px" 
          }} 
        />
        
        <Heading size="4">{auction.nft.name}</Heading>
        <Text size="2" color="gray">{auction.nft.description}</Text>
        
        <Flex direction="column" gap="1">
          <Flex justify="between">
            <Text size="2" color="gray">Current Bid:</Text>
            <Text size="2" weight="bold">{(auction.current_bid / 1e9).toFixed(2)} SUI</Text>
          </Flex>
          <Flex justify="between">
            <Text size="2" color="gray">Time Remaining:</Text>
            <Text size="2" weight="bold" color={isAuctionEnded ? "red" : "green"}>
              {timeRemaining}
            </Text>
          </Flex>
          {auction.highest_bidder && (
            <Flex justify="between">
              <Text size="2" color="gray">Highest Bidder:</Text>
              <Text size="1" weight="bold">
                {isHighestBidder ? "You" : `${auction.highest_bidder.slice(0, 6)}...`}
              </Text>
            </Flex>
          )}
        </Flex>

        {status.type && (
          <Text size="1" color={status.type === "success" ? "green" : "red"}>
            {status.message}
          </Text>
        )}

        {!isAuctionEnded && !isSeller && !showBidForm && (
          <Button size="2" onClick={() => setShowBidForm(true)} disabled={isProcessing}>
            Place Bid
          </Button>
        )}

        {!isAuctionEnded && !isSeller && showBidForm && (
          <Flex direction="column" gap="2">
            <TextField.Root 
              placeholder={`Min: ${(auction.current_bid / 1e9).toFixed(2)} SUI`}
              value={bidAmount} 
              onChange={(e) => setBidAmount(e.target.value)} 
            />
            <Flex gap="2">
              <Button size="2" onClick={handlePlaceBid} disabled={isProcessing}>
                Bid
              </Button>
              <Button size="2" variant="soft" onClick={() => setShowBidForm(false)}>
                Cancel
              </Button>
            </Flex>
          </Flex>
        )}

        {isAuctionEnded && (
          <Button size="2" onClick={handleFinalizeAuction} disabled={isProcessing}>
            {isProcessing ? "Finalizing..." : "Finalize Auction"}
          </Button>
        )}

        {!isAuctionEnded && isSeller && !auction.highest_bidder && (
          <Button size="2" variant="soft" color="red" onClick={handleCancelAuction} disabled={isProcessing}>
            {isProcessing ? "Cancelling..." : "Cancel Auction"}
          </Button>
        )}
      </Flex>
    </Card>
  );
}

export default App;