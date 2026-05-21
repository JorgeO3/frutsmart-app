module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.skybolt.NativeChartForgePackage;',
        packageInstance: 'new NativeChartForgePackage()',
      },
    },
  },
};
