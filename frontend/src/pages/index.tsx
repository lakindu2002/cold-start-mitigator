import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "heatshield/styles/Home.module.css";
import { Header } from "heatshield/components/header";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <>
      <Header
        name="HeatShield"
        description="Eliminate Cold Starts for your AWS Lambda Functions"
      />
    </>
  );
}
