export default function Skeleton({ h = 16, w = "100%" }) {
    return <div style={{
        height: h, width: w, borderRadius: 8,
        background: "linear-gradient(90deg,#eef3f8 25%, #f7fafc 37%, #eef3f8 63%)",
        backgroundSize: "400% 100%", animation: "sk 1.4s ease infinite"
    }} />;
}