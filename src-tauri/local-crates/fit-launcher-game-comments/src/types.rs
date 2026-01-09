use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Comments {
    pub data: CommentData,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct CommentData {
    pub chat: Chat,
    pub comments: Vec<Comment>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Chat {
    pub site_id: i64,
    pub title: String,
    pub hash: String,
    pub identity: Option<Value>,
    pub url: String,
    pub count_comment_all: i64,
    pub count_comment_load: i64,
    pub closed: bool,
    pub format: i64,
    pub root_id: i64,
    pub fixed_comment: Option<Value>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Comment {
    pub id: i64,
    pub text_template: String,
    pub data_create: String,
    pub user: User,
    pub raiting: Raiting,
    #[serde(default)]
    pub attaches: Vec<Value>,
    #[serde(default)]
    pub attaches_icons: Vec<Value>,
    pub attaches_text: String,
    pub sort: Value,
    pub edited: bool,
    pub fixed: bool,
    pub comment_type: i64,
    pub answer_comment_root_id: i64,
    pub answer_comment_count: i64,
    pub answer_comment: Option<Value>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub nick: String,
    pub ava: String,
    pub online: bool,
    pub data_last_visit: String,
    pub admin: bool,
    pub is_verified: bool,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Raiting {
    pub id: i64,
    pub val: i64,
    pub user_val: i64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Attach {
    #[serde(rename = "type")]
    pub type_field: String,
    pub data: Vec<Daum>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Daum {
    pub src: String,
    pub src_o: String,
    pub width: i64,
    pub height: i64,
    #[serde(rename = "type")]
    pub type_field: String,
}
