import { Octokit } from "@octokit/rest";
import sodium from "libsodium-wrappers";
import 'dotenv/config';

const SECRET_METRICOOL = process.env.SECRET_METRICOOL;
const REPO_OWNER = process.env.REPO_OWNER || "";
const REPO_NAME = process.env.REPO_NAME || "";

const EMAIL_1 = process.env.EMAIL_1 || "";
const EMAIL_2 = process.env.EMAIL_2 || "";

if (!REPO_OWNER || !REPO_NAME || !EMAIL_1 || !EMAIL_2) {
  throw new Error("Missing required environment variables");
}

async function getPublicKey(octokit: Octokit) {
    const { data: publicKey } = await octokit.actions.getRepoPublicKey({
        owner: REPO_OWNER,
        repo: REPO_NAME,
    });
    return publicKey;
}

async function encryptSecret(secretValue: string, publicKey: { key: string }) {
    await sodium.ready;

    const binKey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
    const binSecret = sodium.from_string(secretValue);

    const encBytes = sodium.crypto_box_seal(binSecret, binKey);
    const encryptedValue = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

    return encryptedValue;
}

async function getCurrentSecret(octokit: Octokit) {
    try {
        const { data } = await octokit.actions.getRepoSecret({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            secret_name: "METRICOOL_EMAIL",
        });
        return data;
    } catch (error) {
        if ((error as any).status === 404) {
            return null;
        }
        throw error;
    }
}

async function updateMetricoolEmail() {
    if (!SECRET_METRICOOL) {
        throw new Error("SECRET_METRICOOL environment variable is required");
    }

    const octokit = new Octokit({
        auth: SECRET_METRICOOL
    });

    // Get the current secret
    const currentSecret = await getCurrentSecret(octokit);

    // Get current secret value and determine which email to use
    let newEmail: string;
    const secretExists = currentSecret !== null;

    if (secretExists) {
        // Alterner entre les deux emails
        try {
            const current = await octokit.actions.getRepoSecret({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                secret_name: 'METRICOOL_EMAIL'
            });

            // Si le secret existe, on alterne
            newEmail = current.data.created_at === current.data.updated_at ? EMAIL_2 : EMAIL_1;
            console.log(`Switching from ${newEmail === EMAIL_1 ? EMAIL_2 : EMAIL_1} to ${newEmail}`);
        } catch (error) {
            newEmail = EMAIL_1;
            console.log(`Error getting secret details, defaulting to: ${newEmail}`);
        }
    } else {
        // Si le secret n'existe pas, commencer avec EMAIL_1
        newEmail = EMAIL_1;
        console.log(`No existing secret found, starting with: ${newEmail}`);
    }

    // Get public key for encryption
    const publicKey = await getPublicKey(octokit);

    // Encrypt the new secret value
    const encryptedValue = await encryptSecret(newEmail, publicKey);

    // Update the secret
    await octokit.actions.createOrUpdateRepoSecret({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        secret_name: "METRICOOL_EMAIL",
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id
    });

    console.log(`Successfully updated METRICOOL_EMAIL to ${newEmail}`);
}

updateMetricoolEmail().catch(console.error);
