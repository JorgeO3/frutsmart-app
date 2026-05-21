module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: "./android",
        packageImportPath: "import com.chartforge.NativeChartForgePackage;",
        packageInstance: "new NativeChartForgePackage()",
      },
    },
  },
};
