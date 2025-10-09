import {
  useCurrentAccount,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Flex, Heading, Text, Separator, Card, Box } from "@radix-ui/themes";
import { useEffect, useState } from "react";

interface NFTContent {
  id: string;
  name: string;
  description: string;
  image_url: string;
  creator: string;
}

export function OwnedObjects() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [nftDetails, setNftDetails] = useState<NFTContent[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // ✅ Fetch only SimpleNFT objects
  const {
    data: ownedSimpleNFTs,
    isPending: isNFTsPending,
    error: nftsError,
  } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address as string,
      filter: {
        StructType:
          "0x9dc9a29c84fdd5278de566d6289951e1511b5048d4ec1e7f5189fcafc5338b6b::nft_marketplace::SimpleNFT",
      },
    },
    {
      enabled: !!account,
    },
  );

  // ✅ Fetch SUI balance
  const {
    data: balanceData,
    isPending: isBalancePending,
    error: balanceError,
  } = useSuiClientQuery(
    "getBalance",
    {
      owner: account?.address as string,
    },
    {
      enabled: !!account,
    },
  );

  // ✅ Fetch detailed content for each NFT
  useEffect(() => {
    const fetchNFTDetails = async () => {
      if (!ownedSimpleNFTs || ownedSimpleNFTs.data.length === 0) {
        setNftDetails([]);
        return;
      }

      setIsLoadingDetails(true);
      try {
        const detailsPromises = ownedSimpleNFTs.data.map(async (nft) => {
          const objectId = nft.data?.objectId;
          if (!objectId) return null;

          const obj = await client.getObject({
            id: objectId,
            options: { showContent: true },
          });

          const fields = (obj.data?.content as any)?.fields;
          if (!fields) return null;

          return {
            id: objectId,
            name: fields.name,
            description: fields.description,
            image_url: fields.image_url,
            creator: fields.creator,
          };
        });

        const details = await Promise.all(detailsPromises);
        setNftDetails(details.filter((d): d is NFTContent => d !== null));
      } catch (error) {
        console.error("Error fetching NFT details:", error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchNFTDetails();
  }, [ownedSimpleNFTs, client]);

  if (!account) {
    return <Text>Please connect your wallet</Text>;
  }

  if (nftsError || balanceError) {
    return (
      <Flex direction="column" gap="2">
        {nftsError && (
          <Text color="red">Error loading SimpleNFTs: {nftsError.message}</Text>
        )}
        {balanceError && (
          <Text color="red">Error loading balance: {balanceError.message}</Text>
        )}
      </Flex>
    );
  }

  if (isNFTsPending || isBalancePending || !ownedSimpleNFTs || !balanceData) {
    return <Flex>Loading wallet data...</Flex>;
  }

  const balance = Number(balanceData.totalBalance) / 1e9; // convert from Mist to SUI

  return (
    <Flex direction="column" my="2" gap="3">
      <Text>
        <strong>SUI Balance:</strong> {balance.toLocaleString()} SUI
      </Text>
      <Separator my="2" size="4" />

      {isLoadingDetails ? (
        <Text>Loading NFT details...</Text>
      ) : nftDetails.length === 0 ? (
        <Text>No SimpleNFTs owned by the connected wallet</Text>
      ) : (
        <>
          <Heading size="4">Your SimpleNFT Collection</Heading>
          <Flex direction="row" gap="4" wrap="wrap">
            {nftDetails.map((nft) => (
              <Card key={nft.id} style={{ maxWidth: "300px" }}>
                <Flex direction="column" gap="2">
                  <img
                    src={nft.image_url}
                    alt={nft.name}
                    style={{
                      width: "100%",
                      height: "200px",
                      objectFit: "cover",
                      borderRadius: "8px",
                    }}
                  />
                  <Heading size="3">{nft.name}</Heading>
                  <Text size="2" color="gray">
                    {nft.description}
                  </Text>
                  <Separator size="4" />
                  <Box>
                    <Text size="1" color="gray">
                      <strong>Creator:</strong>
                    </Text>
                    <Text size="1" style={{ wordBreak: "break-all" }}>
                      {nft.creator.slice(0, 8)}...{nft.creator.slice(-6)}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="1" color="gray">
                      <strong>Object ID:</strong>
                    </Text>
                    <Text size="1" style={{ wordBreak: "break-all" }}>
                      {nft.id.slice(0, 8)}...{nft.id.slice(-6)}
                    </Text>
                  </Box>
                </Flex>
              </Card>
            ))}
          </Flex>
        </>
      )}
    </Flex>
  );
}