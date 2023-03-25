import { type CLSReportCallback } from "web-vitals";

const reportWebVitals = (onPerfEntry: CLSReportCallback): void => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    void import(/* webpackChunkName: "web-vitals" */ "web-vitals").then(
      ({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
        onCLS(onPerfEntry);
        onFID(onPerfEntry);
        onFCP(onPerfEntry);
        onLCP(onPerfEntry);
        onTTFB(onPerfEntry);
      }
    );
  }
};

export default reportWebVitals;
