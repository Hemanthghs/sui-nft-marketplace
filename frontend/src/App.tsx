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

  const { data: balanceData } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address as string },
    { enabled: !!account }
  );

  const balance = balanceData ? Number(balanceData.totalBalance) / 1e9 : 0;

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

        {isOwned && !showListForm && (
          <Button size="2" onClick={() => setShowListForm(true)} disabled={isProcessing}>
            List for Sale
          </Button>
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

export default App;