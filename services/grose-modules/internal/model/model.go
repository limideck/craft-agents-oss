package model

type Feed struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	URL           string `json:"url"`
	LastFetchedAt *int64 `json:"last_fetched_at"`
}

type Article struct {
	ID            string `json:"id"`
	FeedID        string `json:"feedId"`
	FeedName      string `json:"feedName"`
	Title         string `json:"title"`
	Summary       string `json:"summary"`
	Content       string `json:"content"`
	Link          string `json:"link"`
	PubDate       string `json:"pubDate"`
	Author        string `json:"author"`
	AudioURL      string `json:"audioUrl"`
	AudioDuration string `json:"audioDuration"`
	IsStarred     bool   `json:"isStarred"`
	UpdatedAt     *int64 `json:"updatedAt"`
}
