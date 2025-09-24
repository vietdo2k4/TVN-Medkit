import VideoCallControls from "../components/VideoCallControls";

export default function TelemedicinePage(){
  return (
    <main className="container pv">
      <div className="card">
        <div className="card__title">Phòng tư vấn video</div>
        <div className="video-box">Video placeholder</div>
        <VideoCallControls/>
      </div>
      <div className="card">
        <div className="card__title">Ghi chú</div>
        <textarea className="input" rows="4" placeholder="Ghi chú sau buổi tư vấn..."/>
      </div>
    </main>
  );
}
