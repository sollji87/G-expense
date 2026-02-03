import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // snowflake-sdk를 서버 사이드 전용 패키지로 설정
  serverExternalPackages: ['snowflake-sdk'],
};

export default nextConfig;
