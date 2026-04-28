module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.skybolt.NativeSkyboltPackage;',
        packageInstance: 'new NativeSkyboltPackage()',
      },
    },
  },
};
