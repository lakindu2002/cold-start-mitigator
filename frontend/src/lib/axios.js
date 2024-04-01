import axios from "axios";
import { fetchAuthSession } from "aws-amplify/auth";

const axiosLiveInstance = axios.create();

const setAuthHeader = async (config) => {
  const session = await fetchAuthSession();
  if (session.credentials && config.headers) {
    config.headers.Authorization = session.tokens?.idToken?.toString();
  }
};

axiosLiveInstance.interceptors.request.use(
  async (config) => {
    if (
      config.url?.startsWith("/api/") &&
      !config.url.startsWith("/api/public/")
    ) {
      await setAuthHeader(config);
    }
    return config;
  },
  (error) => {
    Promise.reject(error);
  }
);

export default axiosLiveInstance;
