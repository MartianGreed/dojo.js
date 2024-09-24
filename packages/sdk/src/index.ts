import * as torii from "@dojoengine/torii-client";

import { getEntities } from "./getEntities";
import { getEventMessages } from "./getEventMessages";
import { subscribeEntityQuery } from "./subscribeEntityQuery";
import { subscribeEventQuery } from "./subscribeEventQuery";
import { SchemaType, SDK, UnionOfModelData } from "./types";
import {
  Account,
  Signature,
  StarknetDomain,
  TypedData,
} from "starknet";

export * from "./types";

interface SDKConfig {
  client: torii.ClientConfig;
  domain: StarknetDomain;
}

/**
 * Creates a new Torii client instance.
 *
 * @param {torii.ClientConfig} config - The configuration object for the Torii client.
 * @returns {Promise<torii.ToriiClient>} - A promise that resolves to the Torii client instance.
 */
export async function createClient(
  config: torii.ClientConfig
): Promise<torii.ToriiClient> {
  return await torii.createClient(config);
}

/**
 * Initializes the SDK with the provided configuration and schema.
 *
 * @template T - The schema type.
 * @param {torii.ClientConfig} options - The configuration object for the Torii client.
 * @param {T} schema - The schema object defining the structure of the data.
 * @returns {Promise<SDK<T>>} - A promise that resolves to the initialized SDK.
 */
export async function init<T extends SchemaType>(
  options: SDKConfig,
  schema: T
): Promise<SDK<T>> {
  const client = await createClient(options.client);

  return {
    client,
    /**
     * Subscribes to entity queries.
     *
     * @param {SubscriptionQueryType<T>} query - The query object used to filter entities.
     * @param {(response: { data?: StandardizedQueryResult<T>; error?: Error }) => void} callback - The callback function to handle the response.
     * @param {{ logging?: boolean }} [options] - Optional settings.
     * @returns {Promise<void>} - A promise that resolves when the subscription is set up.
     */
    subscribeEntityQuery: (query, callback, options) =>
      subscribeEntityQuery(client, query, schema, callback, options),
    /**
     * Subscribes to event queries.
     *
     * @param {SubscriptionQueryType<T>} query - The query object used to filter events.
     * @param {(response: { data?: StandardizedQueryResult<T>; error?: Error }) => void} callback - The callback function to handle the response.
     * @param {{ logging?: boolean }} [options] - Optional settings.
     * @returns {Promise<void>} - A promise that resolves when the subscription is set up.
     */
    subscribeEventQuery: (query, callback, options) =>
      subscribeEventQuery(client, query, schema, callback, options),
    /**
     * Fetches entities based on the provided query.
     *
     * @param {SubscriptionQueryType<T>} query - The query object used to filter entities.
     * @param {(response: { data?: StandardizedQueryResult<T>; error?: Error }) => void} callback - The callback function to handle the response.
     * @param {number} [limit=100] - The maximum number of entities to fetch per request. Default is 100.
     * @param {number} [offset=0] - The offset to start fetching entities from. Default is 0.
     * @param {{ logging?: boolean }} [options] - Optional settings.
     * @returns {Promise<StandardizedQueryResult<T>>} - A promise that resolves to the standardized query result.
     */
    getEntities: (query, callback, limit, offset, options) =>
      getEntities(
        client,
        query,
        schema,
        callback,
        limit,
        offset,
        options
      ),
    /**
     * Fetches event messages based on the provided query.
     *
     * @param {SubscriptionQueryType<T>} query - The query object used to filter event messages.
     * @param {(response: { data?: StandardizedQueryResult<T>; error?: Error }) => void} callback - The callback function to handle the response.
     * @param {number} [limit=100] - The maximum number of event messages to fetch per request. Default is 100.
     * @param {number} [offset=0] - The offset to start fetching event messages from. Default is 0.
     * @param {{ logging?: boolean }} [options] - Optional settings.
     * @returns {Promise<StandardizedQueryResult<T>>} - A promise that resolves to the standardized query result.
     */
    getEventMessages: (query, callback, limit, offset, options) =>
      getEventMessages(
        client,
        query,
        schema,
        callback,
        limit,
        offset,
        options
      ),

    /**
     * Generates typed data for any user-defined message.
     *
     * @template M - The message type defined by the schema models.
     * @param {string} primaryType - The primary type of the message.
     * @param {M} message - The user-defined message content, must be part of the schema models.
     * @param {StarknetDomain} [domain] - The domain object. If not provided, uses the default domain from options.
     * @returns {TypedData} - The generated typed data.
     */
    generateTypedData: <M extends UnionOfModelData<T>>(
      primaryType: string,
      message: M,
      domain: StarknetDomain = options.domain
    ): TypedData => ({
      types: {
        StarknetDomain: [
          { name: "name", type: "shortstring" },
          { name: "version", type: "shortstring" },
          { name: "chainId", type: "shortstring" },
          { name: "revision", type: "shortstring" },
        ],
        [primaryType]: Object.keys(message).map((key) => ({
          name: key,
          type:
            typeof message[key] === "bigint" ||
              typeof message[key] === "number"
              ? "felt"
              : "string",
        })),
      },
      primaryType,
      domain,
      message,
    }),

    /**
     * Sends a signed message.
     *
     * @param {TypedData} data - The typed data to be signed and sent.
     * @param {Account} account - The account used to sign the message.
     * @returns {Promise<void>} - A promise that resolves when the message is sent successfully.
     * @throws {Error} If the message sending fails.
     */
    sendMessage: async (
      data: TypedData,
      account: Account
    ): Promise<void> => {
      try {
        // Sign the typed data
        const signature: Signature = await account.signMessage(data);

        // Stringify typed data for publishing
        const dataString = JSON.stringify(data);
        // Publish the signed message
        await client.publishMessage(
          dataString,
          Array.isArray(signature)
            ? signature
            : [signature.r.toString(), signature.s.toString()]
        );
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      }
    },
  };
}
