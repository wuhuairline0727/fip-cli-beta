const { getPageInfo } = require('../lib/fip');

async function testBasic() {
  try {
    const info = await getPageInfo();
    console.log('Page info:', info);
    if (info.url && info.title) {
      console.log('✓ getPageInfo works');
      process.exit(0);
    } else {
      console.error('✗ getPageInfo returned invalid data');
      process.exit(1);
    }
  } catch (e) {
    console.error('✗ getPageInfo failed:', e.message);
    process.exit(1);
  }
}

testBasic();
