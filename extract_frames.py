import cv2
import os

video_path = r"C:/Users/janic/.gemini/antigravity/brain/079b2385-cafa-42ca-b81f-a7ec9bc39533/.user_uploaded/media_1795498609959_152bddaf.mp4"
out_dir = r"C:/Users/janic/.gemini/antigravity/brain/079b2385-cafa-42ca-b81f-a7ec9bc39533"

cap = cv2.VideoCapture(video_path)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
print("Total frames:", total, "FPS:", fps)

# Extract frames at 10%, 30%, 50%, 70%, 90%
positions = [0.1, 0.3, 0.5, 0.7, 0.9]
for i, pos in enumerate(positions):
    frame_no = int(total * pos)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
    ret, frame = cap.read()
    if ret:
        out_path = os.path.join(out_dir, f"frame_{i}.jpg")
        cv2.imwrite(out_path, frame)
        print(f"Saved {out_path}")
cap.release()
