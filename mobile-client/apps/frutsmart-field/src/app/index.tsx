import React from "react";
import { Redirect } from "expo-router";

const IndexScreen = () => {
  return <Redirect href={"/onboard/introduction"} />;
};

export default IndexScreen;
