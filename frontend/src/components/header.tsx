import Head from "next/head";
import { FC } from "react";

interface HeaderProps {
    name: string
    description: string
}


export const Header: FC<HeaderProps> = ({ name, description }) => {
    return (
        <Head>
            <title>{name}</title>
            <meta name="description" content={description} />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
        </Head>
    )
}