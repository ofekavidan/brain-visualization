declare module 'react-plotly.js' {
  import * as React from 'react';
  // טיפוס רופף מספיק לשימוש שלנו
  const Plot: React.ComponentType<any>;
  export default Plot;
}

// (לא חובה, אבל עוזר בעורך)
declare module 'plotly.js-basic-dist';
