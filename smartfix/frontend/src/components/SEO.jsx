import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, url, type = 'website', schema }) => {
  const siteTitle = 'SmartFix | LocalHands';
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const defaultDesc = 'SmartFix connects you directly with zero-commission verified trade workers, plumbers, and electricians in Tamil Nadu & Madurai.';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDesc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDesc} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url || window.location.href} />
      <meta property="og:site_name" content={siteTitle} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || defaultDesc} />
      
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
