import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  jsonLd?: Record<string, unknown>;
}

const BASE_URL = 'https://luminaauto.co.za';

export const SEO = ({
  title,
  description,
  url,
  image = `${BASE_URL}/og-lumina.jpg`,
  type = 'website',
  jsonLd,
}: SEOProps) => {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />

      {/* OpenGraph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content="Lumina Auto" />
      <meta property="og:locale" content="en_ZA" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
