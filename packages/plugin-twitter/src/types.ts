import { z } from "zod";

export interface TweetContent {
    text: string;
}

export interface TweetMetadata {
    id: string;
    userName: string;
}

export const TweetSchema = z.object({
    text: z.string().describe("The text of the tweet"),
});

export const isTweetContent = (obj: any): obj is TweetContent => {
    console.log(obj);
    return TweetSchema.safeParse(obj).success;
};
