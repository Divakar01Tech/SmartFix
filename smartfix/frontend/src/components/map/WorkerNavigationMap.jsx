import React from 'react';
import LiveTrackingMap from './LiveTrackingMap';

const WorkerNavigationMap = (props) => {
  return <LiveTrackingMap {...props} isWorker={true} />;
};

export default WorkerNavigationMap;
