import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import {
  Flex,
  Heading,
  Text,
  Card,
  TextField,
  TextArea,
  Button,
  Callout,
} from "@radix-ui/themes";
import { Transaction } from "@mysten/sui/transactions";
// import ClipLoader from "react-spinners/ClipLoader";

// TODO: Replace with your actual deployed package ID
const PACKAGE_ID =
  "0x9dc9a29c84fdd5278de566d6289951e1511b5048d4ec1e7f5189fcafc5338b6b";

export function CreateNFT() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // ✅ Fetch SUI balance
  const { data: balanceData } = useSuiClientQuery(
    "getBalance",
    {
      owner: account?.address as string,
    },
    {
      enabled: !!account,
    },
  );

  const balance = balanceData ? Number(balanceData.totalBalance) / 1e9 : 0;

  const handleCreateNFT = () => {
    if (!account) {
      setStatus({
        type: "error",
        message: "Please connect your wallet first",
      });
      return;
    }

    if (balance < 0.01) {
      setStatus({
        type: "error",
        message: "Insufficient SUI balance. You need at least 0.01 SUI for gas.",
      });
      return;
    }

    if (!name.trim() || !description.trim() || !imageUrl.trim()) {
      setStatus({
        type: "error",
        message: "Please fill in all fields",
      });
      return;
    }

    setStatus({ type: null, message: "" });
    setIsCreating(true);

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::nft_marketplace::create_nft`,
      arguments: [
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.string(imageUrl),
      ],
    });

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: (result) => {
          suiClient
            .waitForTransaction({ digest: result.digest })
            .then(() => {
              console.log("NFT created successfully:", result);
              setStatus({
                type: "success",
                message: `NFT "${name}" created successfully! Digest: ${result.digest.slice(0, 10)}...`,
              });
              // Reset form
              setName("");
              setDescription("");
              setImageUrl("");
              setIsCreating(false);
            })
            .catch((error) => {
              console.error("Error waiting for transaction:", error);
              setStatus({
                type: "error",
                message: "Transaction submitted but confirmation failed",
              });
              setIsCreating(false);
            });
        },
        onError: (error) => {
          console.error("Error creating NFT:", error);
          setStatus({
            type: "error",
            message: `Failed to create NFT: ${error.message}`,
          });
          setIsCreating(false);
        },
      },
    );
  };

  if (!account) {
    return (
      <Card>
        <Flex direction="column" gap="3" align="center" py="5">
          <Text size="3" color="gray">
            Please connect your wallet to create NFTs
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Card style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Flex direction="column" gap="4">
        <Heading size="5">Create New NFT</Heading>

        <Flex justify="between" align="center">
          <Text size="2" color="gray">
            Your Balance:
          </Text>
          <Text size="3" weight="bold">
            {balance.toFixed(4)} SUI
          </Text>
        </Flex>

        {balance < 0.01 && (
          <Callout.Root color="orange">
            <Callout.Text>
              ⚠️ You need at least 0.01 SUI for gas fees. Please fund your
              wallet first.
            </Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            Name
          </Text>
          <TextField.Root
            placeholder="e.g., Cosmic Dragon"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isCreating}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            Description
          </Text>
          <TextArea
            placeholder="e.g., Legendary digital art"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isCreating}
            rows={3}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">
            Image URL
          </Text>
          <TextField.Root
            placeholder="e.g., https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={isCreating}
          />
        </Flex>

        {imageUrl && (
          <Flex direction="column" gap="2">
            <Text size="2" weight="bold">
              Preview
            </Text>
            <img
              src={imageUrl}
              alt="NFT Preview"
              style={{
                width: "100%",
                maxHeight: "300px",
                objectFit: "contain",
                borderRadius: "8px",
                border: "1px solid var(--gray-6)",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </Flex>
        )}

        {status.type && (
          <Card
            style={{
              backgroundColor:
                status.type === "success" ? "var(--green-3)" : "var(--red-3)",
            }}
          >
            <Text
              size="2"
              color={status.type === "success" ? "green" : "red"}
              weight="medium"
            >
              {status.message}
            </Text>
          </Card>
        )}

        <Button
          size="3"
          onClick={handleCreateNFT}
          disabled={isCreating || !name || !description || !imageUrl}
          style={{ cursor: isCreating ? "wait" : "pointer" }}
        >
          {isCreating ? (
            <Flex align="center" gap="2">
              {/* <ClipLoader size={20} color="#ffffff" /> */}
              <Text>Creating NFT...</Text>
            </Flex>
          ) : (
            "Create NFT"
          )}
        </Button>

        <Text size="1" color="gray" style={{ textAlign: "center" }}>
          Estimated gas: ~0.01 SUI
        </Text>
      </Flex>
    </Card>
  );
}