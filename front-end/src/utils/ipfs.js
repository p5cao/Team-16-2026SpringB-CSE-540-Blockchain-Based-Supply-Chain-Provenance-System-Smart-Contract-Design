// Pinata IPFS upload utility.
// Set REACT_APP_PINATA_JWT in your .env.local (local) or .env (production).
const PINATA_JWT = process.env.REACT_APP_PINATA_JWT;

/**
 * Uploads a JSON object to IPFS via Pinata and returns the CID.
 * @param {Object} productData - Metadata object to pin.
 * @returns {Promise<string>} The IPFS CID (e.g. "QmXxxx...").
 */
export const uploadToIPFS = async (productData) => {
    if (!PINATA_JWT) {
        throw new Error(
            "REACT_APP_PINATA_JWT is not configured. " +
            "Add it to front-end/.env.local before uploading."
        );
    }

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
            pinataContent: productData,
            pinataMetadata: {
                name: `Batch-${productData.id}-Metadata.json`,
            },
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("Pinata error response:", text);
        throw new Error(`Pinata upload failed (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    return data.IpfsHash; // e.g. "QmXxxx..."
};
