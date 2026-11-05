import markup from './home-markup';
export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <script src="/app.js" defer />
    </>
  );
}
